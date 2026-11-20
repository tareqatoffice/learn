/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Dynamic programming
 *
 * Each must run in polynomial time; the checks use inputs that hang a plain
 * recursive solution. No `any`.
 */

/** The n-th Fibonacci number as a bigint, with fib(0) = 0 and fib(1) = 1. */
export function fibonacci(_n: number): bigint {
  throw new Error("Not implemented");
}

/** The fewest coins that sum to `amount`, or -1. Coins can repeat. */
export function coinChange(_coins: readonly number[], _amount: number): number {
  throw new Error("Not implemented");
}

/** The length of the longest strictly increasing subsequence. */
export function longestIncreasing(_values: readonly number[]): number {
  throw new Error("Not implemented");
}

export interface KnapsackItem {
  weight: number;
  value: number;
}

/** The best total value within `capacity`, using each item at most once. */
export function knapsack(_items: readonly KnapsackItem[], _capacity: number): number {
  throw new Error("Not implemented");
}
