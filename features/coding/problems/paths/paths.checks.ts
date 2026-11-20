import { check, eq } from "../harness";
import type { Group } from "../harness";
import { flattenKeys, getPath, setPath, unflattenKeys } from "./paths";

export const paths: Group = {
  slug: "paths",
  title: "Object paths",
  level: "Intermediate",
  questions: [
    {
      name: "getPath",
      checks: [
        eq("Reads a nested value", () => getPath({ a: { b: 1 } }, "a.b"), 1),
        eq("Indexes into arrays", () => getPath({ a: [{ b: 2 }] }, "a.0.b"), 2),
        eq("Returns the fallback when missing", () => getPath({ a: null }, "a.b", "none"), "none"),
        eq("Keeps falsy values", () => getPath({ a: 0 }, "a", 5), 0),
      ],
    },
    {
      name: "setPath",
      checks: [
        eq("Sets a nested value", () => setPath({ a: { b: 1 } }, "a.b", 2), { a: { b: 2 } }),
        eq("Creates missing objects", () => setPath({}, "a.b.c", 1), { a: { b: { c: 1 } } }),
        check("Keeps the input and sibling references", () => {
          const sibling = { x: 1 };
          const source = { a: { b: 1 }, sibling };
          const result = setPath(source, "a.b", 2);
          if (source.a.b !== 1) return "input changed";
          return result.sibling === sibling || "sibling was copied";
        }),
      ],
    },
    {
      name: "flattenKeys",
      checks: [
        eq("Flattens nested keys", () => flattenKeys({ a: { b: 1 }, c: 2 }), { "a.b": 1, c: 2 }),
        eq("Keeps arrays as values", () => flattenKeys({ a: { b: [1] } }), { "a.b": [1] }),
        eq("Keeps empty objects as values", () => flattenKeys({ a: {} }), { a: {} }),
      ],
    },
    {
      name: "unflattenKeys",
      checks: [
        eq("Rebuilds nesting", () => unflattenKeys({ "a.b": 1, c: 2 }), { a: { b: 1 }, c: 2 }),
        eq("Merges shared prefixes", () => unflattenKeys({ "a.b": 1, "a.c": 2 }), { a: { b: 1, c: 2 } }),
        eq("Handles an empty object", () => unflattenKeys({}), {}),
      ],
    },
  ],
};
