import { check, eq } from "../harness";
import type { Group } from "../harness";
import { invert, mapValues, omit, pick } from "./objects";

export const objects: Group = {
  slug: "objects",
  title: "Objects",
  level: "Intermediate",
  questions: [
    {
      name: "pick",
      checks: [
        eq("Copies the listed keys", () => pick({ a: 1, b: 2 }, ["a"]), { a: 1 }),
        eq("Skips keys that are absent", () => pick<{ a?: number; b: number }, "a">({ b: 2 }, ["a"]), {}),
        check("Returns a new object", () => {
          const source = { a: 1 };
          return pick(source, ["a"]) !== source || "returned the input";
        }),
      ],
    },
    {
      name: "omit",
      checks: [
        eq("Removes the listed keys", () => omit({ a: 1, b: 2 }, ["a"]), { b: 2 }),
        eq("With no keys it copies everything", () => omit({ a: 1 }, []), { a: 1 }),
        check("Does not mutate the input", () => {
          const source = { a: 1, b: 2 };
          omit(source, ["a"]);
          return "a" in source || "input changed";
        }),
      ],
    },
    {
      name: "mapValues",
      checks: [
        eq("Maps each value", () => mapValues({ a: 1, b: 2 }, (v) => v * 2), { a: 2, b: 4 }),
        eq("Passes the key", () => mapValues({ a: 1 }, (v, k) => `${k}${v}`), { a: "a1" }),
        eq("Handles an empty object", () => mapValues({}, (v) => v), {}),
      ],
    },
    {
      name: "invert",
      checks: [
        eq("Swaps keys and values", () => invert({ a: "x", b: "y" }), { x: "a", y: "b" }),
        eq("Last key wins on duplicates", () => invert({ a: "x", b: "x" }), { x: "b" }),
        check('"__proto__" works as a value', () => {
          const result = invert({ a: "__proto__" });
          return Object.keys(result).includes("__proto__") || "the key was lost";
        }),
      ],
    },
  ],
};
