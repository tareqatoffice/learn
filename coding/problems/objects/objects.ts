/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Objects
 *
 * Implement every export. Return new objects; never mutate the input. No `any`.
 */

/** Copy only `keys` that exist on `source`. */
export function pick<T extends object, K extends keyof T>(_source: T, _keys: readonly K[]): Pick<T, K> {
  throw new Error("Not implemented");
}

/** Copy everything except `keys`. */
export function omit<T extends object, K extends keyof T>(_source: T, _keys: readonly K[]): Omit<T, K> {
  throw new Error("Not implemented");
}

/** Build a new object with `fn(value, key)` for each own key. */
export function mapValues<V, R>(_source: Record<string, V>, _fn: (value: V, key: string) => R): Record<string, R> {
  throw new Error("Not implemented");
}

/** Swap keys and values. On duplicate values the last key wins. "__proto__" must work like any key. */
export function invert(_source: Record<string, string>): Record<string, string> {
  throw new Error("Not implemented");
}
