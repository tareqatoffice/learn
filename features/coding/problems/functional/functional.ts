/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Functional helpers
 *
 * Implement every export. No `any`.
 */

/** compose(f, g)(x) is f(g(x)). With no functions it returns the input. */
export function compose<T>(..._fns: readonly ((value: T) => T)[]): (value: T) => T {
  throw new Error("Not implemented");
}

/** pipe(f, g)(x) is g(f(x)). */
export function pipe<T>(..._fns: readonly ((value: T) => T)[]): (value: T) => T {
  throw new Error("Not implemented");
}

/** Fix the first arguments of `fn`. */
export function partial<H extends unknown[], T extends unknown[], R>(
  _fn: (...args: [...H, ...T]) => R,
  ..._head: H
): (...tail: T) => R {
  throw new Error("Not implemented");
}

/** Call `fn` at most once; later calls return the first result. If the first call throws, the next call retries. */
export function once<A extends unknown[], R>(_fn: (...args: A) => R): (...args: A) => R {
  throw new Error("Not implemented");
}

/** Cache results by `getKey(...args)`, which defaults to the first argument. Cached undefined still counts. */
export function memoize<A extends unknown[], R>(
  _fn: (...args: A) => R,
  _getKey: (...args: A) => unknown = (...args) => args[0],
): (...args: A) => R {
  throw new Error("Not implemented");
}
