/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Arrays
 *
 * Implement every export. None of them may mutate their input. No `any`.
 */

/** Split `items` into arrays of `size`; the last may be shorter. Throw a RangeError when size < 1. */
export function chunk<T>(_items: readonly T[], _size: number): T[][] {
  throw new Error("Not implemented");
}

/** Keep the first item for each distinct `getKey(item)`, in input order. */
export function uniqueBy<T, K>(_items: readonly T[], _getKey: (item: T) => K): T[] {
  throw new Error("Not implemented");
}

/** Flatten nested arrays up to `depth` levels. Do not use Array.prototype.flat. */
export function flattenDepth(_items: readonly unknown[], _depth: number): unknown[] {
  throw new Error("Not implemented");
}

/** Return [matching, rest], both in input order. */
export function partition<T>(_items: readonly T[], _predicate: (item: T) => boolean): [T[], T[]] {
  throw new Error("Not implemented");
}

/** Pair items by index, stopping at the shorter array. */
export function zip<A, B>(_a: readonly A[], _b: readonly B[]): [A, B][] {
  throw new Error("Not implemented");
}
