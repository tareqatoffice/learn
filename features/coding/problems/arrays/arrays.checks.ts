import { chunk, flattenDepth, partition, uniqueBy, zip } from "./arrays";
import { check, eq, throws } from "../harness";
import type { Group } from "../harness";

export const arrays: Group = {
  slug: "arrays",
  title: "Arrays",
  level: "Intermediate",
  questions: [
    {
      name: "chunk",
      checks: [
        eq("Splits evenly", () => chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]),
        eq("Keeps a short last chunk", () => chunk([1, 2, 3], 2), [[1, 2], [3]]),
        eq("Returns [] for an empty array", () => chunk([], 3), []),
        throws("Throws a RangeError when size is 0", () => chunk([1], 0), RangeError),
      ],
    },
    {
      name: "uniqueBy",
      checks: [
        eq("Keeps the first item per key", () => uniqueBy([{ id: 1, n: "a" }, { id: 1, n: "b" }, { id: 2, n: "c" }], (x) => x.id), [{ id: 1, n: "a" }, { id: 2, n: "c" }]),
        eq("Keeps input order", () => uniqueBy([3, 1, 3, 2], (x) => x), [3, 1, 2]),
        eq("Treats 1 and '1' as different keys", () => uniqueBy<string | number, string | number>([1, "1"], (x) => x), [1, "1"]),
      ],
    },
    {
      name: "flattenDepth",
      checks: [
        eq("Flattens one level", () => flattenDepth([1, [2, [3]]], 1), [1, 2, [3]]),
        eq("Flattens two levels", () => flattenDepth([1, [2, [3, [4]]]], 2), [1, 2, 3, [4]]),
        eq("Depth 0 returns a copy", () => flattenDepth([[1]], 0), [[1]]),
      ],
    },
    {
      name: "partition",
      checks: [
        eq("Splits by predicate", () => partition([1, 2, 3, 4], (n) => n % 2 === 0), [[2, 4], [1, 3]]),
        eq("Handles no matches", () => partition([1], () => false), [[], [1]]),
        eq("Handles an empty array", () => partition([], () => true), [[], []]),
      ],
    },
    {
      name: "zip",
      checks: [
        eq("Pairs by index", () => zip([1, 2], ["a", "b"]), [[1, "a"], [2, "b"]]),
        eq("Stops at the shorter array", () => zip([1, 2, 3], ["a"]), [[1, "a"]]),
        check("Does not mutate inputs", () => {
          const a = [1];
          zip(a, [2]);
          return a.length === 1 || "input changed";
        }),
      ],
    },
  ],
};
