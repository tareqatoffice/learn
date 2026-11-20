/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Timing
 *
 * Implement every export with real timers. Leave no timer running after a
 * cancel or abort. No `any`.
 */

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
}

/** Run `fn` with the latest arguments once `ms` has passed since the last call. `cancel` drops a pending run. */
export function debounce<A extends unknown[]>(_fn: (...args: A) => void, _ms: number): Debounced<A> {
  throw new Error("Not implemented");
}

/** Run on the first call, then ignore calls until `ms` has passed. */
export function throttle<A extends unknown[]>(_fn: (...args: A) => void, _ms: number): (...args: A) => void {
  throw new Error("Not implemented");
}

/** Resolve after `ms`. When `signal` aborts, reject with `signal.reason` at once. */
export function sleep(_ms: number, _signal?: AbortSignal): Promise<void> {
  throw new Error("Not implemented");
}

export class TimeoutError extends Error {}

/** Settle like `promise`, or reject with a TimeoutError after `ms`. */
export function withTimeout<T>(_promise: Promise<T>, _ms: number): Promise<T> {
  throw new Error("Not implemented");
}
