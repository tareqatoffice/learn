import { check, eq } from "../harness";
import type { Group } from "../harness";
import { construct, curry, customBind, isInstanceOf, sql } from "./language";
import type { Curried } from "./language";

function Point(this: object, x: number): void {
  Object.assign(this, { x });
}

const call = (fn: Curried | number, ...args: number[]): Curried | number =>
  typeof fn === "number" ? fn : fn(...args);

const add3 = (a: number, b: number, c: number): number => a + b + c;

export const language: Group = {
  slug: "language",
  title: "Language",
  level: "Intermediate",
  questions: [
    {
      name: "customBind",
      checks: [
        check("Fixes this", () => {
          const bound = customBind(function (this: unknown) {
            return this;
          }, "owner");
          return bound() === "owner" || "this was not fixed";
        }),
        eq("Keeps leading arguments", () => customBind((a: number, b: number) => a + b, null, 1)(2), 3),
        check("Does not use Function.prototype.bind", () => {
          const original = Function.prototype.bind;
          let used = false;
          Function.prototype.bind = function (this: never): never {
            used = true;
            return this;
          };
          try {
            customBind(() => 1, null)();
          } finally {
            Function.prototype.bind = original;
          }
          return !used || "bind was called";
        }),
      ],
    },
    {
      name: "construct",
      checks: [
        eq("Runs the constructor on a new object", () => construct(Point, 3), { x: 3 }),
        check("Links the prototype", () => {
          const made = construct(Point, 1);
          return Object.getPrototypeOf(made) === Point.prototype || "prototype is not linked";
        }),
        eq("Returns an object the constructor returns", () => construct(function () { return { x: 9 }; }), { x: 9 }),
        eq("Ignores a primitive return value", () => construct(function (this: object) {
          Object.assign(this, { x: 1 });
          return 5;
        }), { x: 1 }),
      ],
    },
    {
      name: "isInstanceOf",
      checks: [
        eq("True for a direct instance", () => isInstanceOf([], Array), true),
        eq("True further up the chain", () => isInstanceOf([], Object), true),
        eq("False for unrelated classes", () => isInstanceOf(new Map(), Set), false),
        eq("False for primitives", () => isInstanceOf(1, Number), false),
        eq("False for null", () => isInstanceOf(null, Object), false),
      ],
    },
    {
      name: "curry",
      checks: [
        eq("One at a time", () => call(call(curry(add3)(1), 2), 3), 6),
        eq("All at once", () => curry(add3)(1, 2, 3), 6),
        eq("Partial groups", () => call(curry(add3)(1, 2), 3), 6),
        eq("A partial can be reused", () => {
          const addOne = curry(add3)(1);
          return [call(addOne, 1, 1), call(addOne, 2, 2)];
        }, [3, 5]),
      ],
    },
    {
      name: "sql",
      checks: [
        eq("Numbers placeholders", () => sql`a = ${1} and b = ${"x"}`, { text: "a = $1 and b = $2", values: [1, "x"] }),
        eq("Handles no values", () => sql`select 1`, { text: "select 1", values: [] }),
        eq("Keeps a trailing string", () => sql`${1} end`, { text: "$1 end", values: [1] }),
      ],
    },
  ],
};
