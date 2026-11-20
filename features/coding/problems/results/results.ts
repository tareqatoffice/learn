/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Result types
 *
 * Model failure as data with a discriminated union. No `any` and no `as`.
 */

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T,>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E,>(error: E): Result<never, E> => ({ ok: false, error });

/** Apply `fn` to a success; pass failures through unchanged. */
export function mapResult<T, E, R>(_result: Result<T, E>, _fn: (value: T) => R): Result<R, E> {
  throw new Error("Not implemented");
}

/** Chain a step that can fail. */
export function andThen<T, E, R>(_result: Result<T, E>, _fn: (value: T) => Result<R, E>): Result<R, E> {
  throw new Error("Not implemented");
}

/** The value, or `fallback` on failure. */
export function unwrapOr<T, E>(_result: Result<T, E>, _fallback: T): T {
  throw new Error("Not implemented");
}

/** Run an async function; a rejection becomes an error result, never a rejected promise. */
export async function tryAsync<T>(_fn: () => Promise<T>): Promise<Result<T, unknown>> {
  throw new Error("Not implemented");
}

/** All values when every result succeeds, otherwise the first failure. */
export function collectResults<T, E>(_results: readonly Result<T, E>[]): Result<T[], E> {
  throw new Error("Not implemented");
}
