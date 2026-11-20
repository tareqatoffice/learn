/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Metaprogramming
 *
 * Proxy, Reflect, iterators, WeakMap and regular expressions. No `any`.
 */

/** A Proxy over `target` that calls onChange(key, value, previous) after every set that changes a value. */
export function observable<T extends object>(_target: T, _onChange: (key: string, value: unknown, previous: unknown) => void): T {
  throw new Error("Not implemented");
}

/** A Proxy over a copy of `items` where a negative index reads from the end: list[-1] is the last item. */
export function negativeArray<T>(_items: readonly T[]): T[] {
  throw new Error("Not implemented");
}

/** An iterable of start, start + step, ... up to but excluding end. It can be iterated more than once. */
export class Range implements Iterable<number> {
  constructor(_start: number, _end: number, _step = 1) {
    throw new Error("Not implemented");
  }

  [Symbol.iterator](): Iterator<number> {
    throw new Error("Not implemented");
  }
}

/** Cache `fn` per object key in a WeakMap, so cached entries never keep a key alive. */
export function weakMemoize<K extends object, V>(_fn: (key: K) => V): (key: K) => V {
  throw new Error("Not implemented");
}

/**
 * Parse "2026-01-31 12:00:05 [ERROR] message" with one regular expression with named
 * groups into { date, time, level, message }. Return null when the line does not match.
 */
export function parseLogLine(_line: string): { date: string; time: string; level: string; message: string } | null {
  throw new Error("Not implemented");
}
