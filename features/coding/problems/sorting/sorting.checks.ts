import { check, eq, throws } from "../harness";
import type { Group } from "../harness";
import { binarySearch, kthSmallest, mergeSort, sortBy } from "./sorting";

export const sorting: Group = {
  slug: "sorting",
  title: "Search and sort",
  level: "Intermediate",
  questions: [
    {
      name: "binarySearch",
      checks: [
        eq("Finds a value", () => binarySearch([1, 3, 5, 7], 5), 2),
        eq("Finds both ends", () => [binarySearch([1, 3], 1), binarySearch([1, 3], 3)], [0, 1]),
        eq("Returns -1 when missing", () => [binarySearch([1, 3], 2), binarySearch([], 1)], [-1, -1]),
      ],
    },
    {
      name: "mergeSort",
      checks: [
        eq("Sorts", () => mergeSort([3, 1, 2], (a, b) => a - b), [1, 2, 3]),
        eq("Is stable", () => mergeSort([{ k: 1, v: "a" }, { k: 0, v: "b" }, { k: 1, v: "c" }], (a, b) => a.k - b.k).map((x) => x.v), ["b", "a", "c"]),
        check("Does not mutate", () => {
          const input = [2, 1];
          mergeSort(input, (a, b) => a - b);
          return input[0] === 2 || "input changed";
        }),
      ],
    },
    {
      name: "sortBy",
      checks: [
        eq("Sorts by several keys", () => sortBy([{ a: 1, b: 2 }, { a: 1, b: 1 }, { a: 0, b: 9 }], [{ by: (x) => x.a }, { by: (x) => x.b }]).map((x) => x.b), [9, 1, 2]),
        eq("Honours desc", () => sortBy([1, 3, 2], [{ by: (x) => x, desc: true }]), [3, 2, 1]),
        eq("Sorts strings", () => sortBy(["b", "a"], [{ by: (x) => x }]), ["a", "b"]),
      ],
    },
    {
      name: "kthSmallest",
      checks: [
        eq("Finds the value", () => kthSmallest([5, 1, 4, 2], 2), 2),
        eq("Counts duplicates", () => kthSmallest([1, 1, 2], 2), 1),
        throws("Throws a RangeError out of range", () => kthSmallest([1], 2), RangeError),
      ],
    },
  ],
};
