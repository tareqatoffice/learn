/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Search and sort
 *
 * Do not call Array.prototype.sort except where noted. Never mutate the input. No `any`.
 */

/** The index of `target` in a sorted array, or -1. Must be O(log n). */
export function binarySearch(_items: readonly number[], _target: number): number {
  throw new Error("Not implemented");
}

/** A stable merge sort returning a new array. */
export function mergeSort<T>(_items: readonly T[], _compare: (a: T, b: T) => number): T[] {
  throw new Error("Not implemented");
}

export interface SortKey<T> {
  by: (item: T) => string | number;
  desc?: boolean;
}

/** Sort by several keys in priority order, stable. Array.prototype.sort is allowed here. */
export function sortBy<T>(_items: readonly T[], _keys: readonly SortKey<T>[]): T[] {
  throw new Error("Not implemented");
}

/** The k-th smallest value, 1-based. Throw a RangeError when k is out of range. */
export function kthSmallest(_items: readonly number[], _k: number): number {
  throw new Error("Not implemented");
}
