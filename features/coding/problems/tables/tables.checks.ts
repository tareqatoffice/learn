import { eq } from "../harness";
import type { Group } from "../harness";
import { paginate, paginationRange, pivot, sumBy } from "./tables";

const sales = [
  { who: "a", month: "jan", n: 1 },
  { who: "a", month: "jan", n: 2 },
  { who: "b", month: "feb", n: 5 },
];

export const tables: Group = {
  slug: "tables",
  title: "Table logic",
  level: "Intermediate",
  questions: [
    {
      name: "paginate",
      checks: [
        eq("Returns a page", () => paginate([1, 2, 3], 2, 2), { items: [3], page: 2, totalPages: 2 }),
        eq("Clamps the page", () => paginate([1], 9, 2).page, 1),
        eq("Handles an empty list", () => paginate([], 1, 2), { items: [], page: 1, totalPages: 1 }),
      ],
    },
    {
      name: "paginationRange",
      checks: [
        eq("Shows all short ranges", () => paginationRange(2, 3), [1, 2, 3]),
        eq("Adds both gaps", () => paginationRange(5, 10), [1, "...", 4, 5, 6, "...", 10]),
        eq("Fills a one-page gap", () => paginationRange(3, 10), [1, 2, 3, 4, "...", 10]),
      ],
    },
    {
      name: "sumBy",
      checks: [
        eq("Sums per key", () => sumBy(sales, (s) => s.who, (s) => s.n), { a: 3, b: 5 }),
        eq("Handles no rows", () => sumBy([], String, Number), {}),
        eq("Handles zero and negatives", () => sumBy([0, -1], () => "x", (n) => n), { x: -1 }),
      ],
    },
    {
      name: "pivot",
      checks: [
        eq("Builds rows and columns", () => pivot(sales, (s) => s.who, (s) => s.month, (s) => s.n), { a: { jan: 3 }, b: { feb: 5 } }),
        eq("Handles no rows", () => pivot([], String, String, Number), {}),
        eq("Keeps columns separate", () => pivot([1, 2], () => "r", (n) => `c${n}`, (n) => n), { r: { c1: 1, c2: 2 } }),
      ],
    },
  ],
};
