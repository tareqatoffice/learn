/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Reactive signals
 *
 * Build a tiny reactive system in this one file. Dependencies are tracked
 * automatically when a signal is read inside an effect or computed. Module
 * state and private helpers are allowed. No `any`.
 */

export interface Signal<T> {
  get(): T;
  set(value: T): void;
}

/** A value holder. `set` with an Object.is-equal value notifies nobody. */
export function createSignal<T>(_initial: T): Signal<T> {
  throw new Error("Not implemented");
}

/** Run `fn` now and again when a signal it read changes. Reads are re-tracked on each run. Return a dispose function. */
export function createEffect(_fn: () => void): () => void {
  throw new Error("Not implemented");
}

/** A read-only derived value, recomputed only after one of its signals changes. */
export function createComputed<T>(_fn: () => T): () => T {
  throw new Error("Not implemented");
}

/** Run `fn`; effects triggered inside run once, after it finishes. Nested batches flush at the outermost end. */
export function batch(_fn: () => void): void {
  throw new Error("Not implemented");
}
