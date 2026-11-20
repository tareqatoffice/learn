import { deepClone, deepEqual, deepFreeze, deepMerge, diffKeys } from "./deep";
import { check, eq } from "../harness";
import type { Group } from "../harness";

interface Loop {
  self?: Loop;
}

export const deep: Group = {
  slug: "deep",
  title: "Deep operations",
  level: "Advanced",
  questions: [
    {
      name: "deepClone",
      checks: [
        check("Nested values are new references", () => {
          const source = { a: { b: [1] } };
          const copy = deepClone(source);
          copy.a.b.push(2);
          return source.a.b.length === 1 || "shares a reference";
        }),
        check("Dates stay Dates", () => {
          const copy = deepClone({ at: new Date(5) });
          return (copy.at instanceof Date && copy.at.getTime() === 5) || "date was lost";
        }),
        check("Handles circular references", () => {
          const source: Loop = {};
          source.self = source;
          const copy = deepClone(source);
          if (copy === source) return "returned the input";
          return copy.self === copy || "the cycle was not preserved";
        }),
      ],
    },
    {
      name: "deepEqual",
      checks: [
        eq("Ignores key order", () => deepEqual({ a: 1, b: [2] }, { b: [2], a: 1 }), true),
        eq("NaN equals NaN", () => deepEqual({ a: NaN }, { a: NaN }), true),
        eq("Arrays differ from objects", () => deepEqual([1], { 0: 1 }), false),
        eq("Detects a nested difference", () => deepEqual({ a: { b: 1 } }, { a: { b: 2 } }), false),
        eq("Missing and undefined keys differ", () => deepEqual({ a: undefined }, { b: undefined }), false),
      ],
    },
    {
      name: "deepMerge",
      checks: [
        eq("Merges nested objects", () => deepMerge({ a: { x: 1 } }, { a: { y: 2 } }), { a: { x: 1, y: 2 } }),
        eq("Arrays replace", () => deepMerge({ a: [1, 2] }, { a: [3] }), { a: [3] }),
        check("Ignores __proto__", () => {
          const payload: Record<string, unknown> = JSON.parse('{"__proto__":{"polluted":1}}');
          const result = deepMerge({}, payload);
          return !("polluted" in result) || "prototype was polluted";
        }),
      ],
    },
    {
      name: "deepFreeze",
      checks: [
        check("Freezes nested objects", () => {
          const value = deepFreeze({ a: { b: [1] } });
          return (Object.isFrozen(value.a) && Object.isFrozen(value.a.b)) || "nested value not frozen";
        }),
        check("Returns the same object", () => {
          const value = {};
          return deepFreeze(value) === value || "returned a copy";
        }),
        check("Handles circular references", () => {
          const value: Loop = {};
          value.self = value;
          return Object.isFrozen(deepFreeze(value)) || "not frozen";
        }),
      ],
    },
    {
      name: "diffKeys",
      checks: [
        eq("Finds changed paths", () => diffKeys({ a: { b: 1, c: 2 } }, { a: { b: 9, c: 2 } }), ["a.b"]),
        eq("Finds added and removed keys, sorted", () => diffKeys({ b: 1 }, { a: 1 }), ["a", "b"]),
        eq("Equal objects have no diff", () => diffKeys({ a: [1] }, { a: [1] }), []),
      ],
    },
  ],
};
