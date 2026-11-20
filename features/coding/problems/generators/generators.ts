/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Generators
 *
 * Use generator functions. Every helper must be lazy, so it works with endless
 * sources. No `any`.
 */

/** Yield 1, 2, 3, ... forever. */
export function* naturals(): Generator<number> {
  throw new Error("Not implemented");
}

/** Yield at most `count` items, then stop without reading further. */
export function* take<T>(_source: Iterable<T>, _count: number): Generator<T> {
  throw new Error("Not implemented");
}

/** Yield `fn(item)` for each item. */
export function* mapIter<T, R>(_source: Iterable<T>, _fn: (item: T) => R): Generator<R> {
  throw new Error("Not implemented");
}

/** Yield arrays of `size` items; the last may be shorter. */
export function* batched<T>(_source: Iterable<T>, _size: number): Generator<T[]> {
  throw new Error("Not implemented");
}

/** Read an async iterable into an array. */
export async function collectAsync<T>(_source: AsyncIterable<T>): Promise<T[]> {
  throw new Error("Not implemented");
}
