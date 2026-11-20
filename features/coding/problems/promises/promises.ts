/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Promise combinators
 *
 * Rebuild these from `new Promise` without calling the Promise.all family. No `any`.
 */

/** Like Promise.all: results in input order; reject on the first rejection. Plain values are allowed. */
export function promiseAll<T>(_values: readonly (T | Promise<T>)[]): Promise<T[]> {
  throw new Error("Not implemented");
}

export type Settled<T> = { status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown };

/** Like Promise.allSettled. Never rejects. */
export function promiseAllSettled<T>(_values: readonly (T | Promise<T>)[]): Promise<Settled<T>[]> {
  throw new Error("Not implemented");
}

/** Like Promise.race. */
export function promiseRace<T>(_values: readonly (T | Promise<T>)[]): Promise<T> {
  throw new Error("Not implemented");
}

/** Like Promise.any: first fulfilment wins; if all reject, reject with an AggregateError of the reasons in input order. */
export function promiseAny<T>(_values: readonly (T | Promise<T>)[]): Promise<T> {
  throw new Error("Not implemented");
}
