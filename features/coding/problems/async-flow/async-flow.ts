/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Async flow
 *
 * Implement every export. No `any`.
 */

/** Run tasks one at a time and return their results. Stop at the first rejection. */
export async function series<T>(_tasks: readonly (() => Promise<T>)[]): Promise<T[]> {
  throw new Error("Not implemented");
}

/** Pass `initial` through each async step, feeding each result to the next. */
export async function waterfall<T>(_initial: T, _steps: readonly ((value: T) => Promise<T>)[]): Promise<T> {
  throw new Error("Not implemented");
}

export interface PollOptions {
  intervalMs: number;
  timeoutMs: number;
}

/** Call `fn` right away, then every intervalMs until it returns non-null. Reject with an Error once timeoutMs has passed. */
export async function pollUntil<T>(_fn: () => Promise<T | null>, _options: PollOptions): Promise<T> {
  throw new Error("Not implemented");
}

/**
 * Collect keys passed to the returned function during one tick (setTimeout 0),
 * then call `load` once with the unique keys. `load` returns values in key
 * order. Each caller resolves with its key's value; if `load` rejects, all reject.
 */
export function createBatcher<K, V>(_load: (keys: K[]) => Promise<V[]>): (key: K) => Promise<V> {
  throw new Error("Not implemented");
}
