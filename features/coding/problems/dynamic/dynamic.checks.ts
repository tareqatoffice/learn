import { coinChange, fibonacci, knapsack, longestIncreasing } from "./dynamic";
import { check, eq } from "../harness";
import type { Group } from "../harness";

export const dynamic: Group = {
  slug: "dynamic",
  title: "Dynamic programming",
  level: "Advanced",
  questions: [
    {
      name: "fibonacci",
      checks: [
        check("Handles the base cases", () => (String(fibonacci(0)) === "0" && String(fibonacci(1)) === "1") || "wrong base case"),
        check("fib(10) is 55", () => String(fibonacci(10)) === "55" || `got ${fibonacci(10)}`),
        check("fib(90) stays exact", () => String(fibonacci(90)) === "2880067194370816120" || `got ${fibonacci(90)}`),
      ],
    },
    {
      name: "coinChange",
      checks: [
        eq("Finds the fewest coins", () => coinChange([1, 3, 4], 6), 2),
        eq("Returns -1 when impossible", () => coinChange([2], 3), -1),
        eq("Handles a large amount", () => coinChange([1, 5, 10, 25], 10_000), 400),
      ],
    },
    {
      name: "longestIncreasing",
      checks: [
        eq("Finds the length", () => longestIncreasing([10, 9, 2, 5, 3, 7, 101, 18]), 4),
        eq("Is strict", () => longestIncreasing([2, 2, 2]), 1),
        eq("Handles an empty list", () => longestIncreasing([]), 0),
      ],
    },
    {
      name: "knapsack",
      checks: [
        eq("Finds the best value", () => knapsack([{ weight: 1, value: 1 }, { weight: 3, value: 4 }, { weight: 4, value: 5 }], 7), 9),
        eq("Uses each item once", () => knapsack([{ weight: 1, value: 10 }], 5), 10),
        eq("Handles many items", () => knapsack(Array.from({ length: 60 }, () => ({ weight: 2, value: 3 })), 100), 150),
      ],
    },
  ],
};
