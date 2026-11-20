/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Object paths
 *
 * Paths are dot separated, such as "user.address.city". Numeric segments index
 * arrays. Implement every export without mutating the input. No `any`.
 */

/** Read a path. Return `fallback` when any segment is missing. */
export function getPath(_source: unknown, _path: string, _fallback?: unknown): unknown {
  throw new Error("Not implemented");
}

/** Return a copy with the path set, creating objects on the way. Untouched branches keep their references. */
export function setPath(_source: Record<string, unknown>, _path: string, _value: unknown): Record<string, unknown> {
  throw new Error("Not implemented");
}

/** Turn nested objects into a single level with dotted keys. Arrays and empty objects are leaf values. */
export function flattenKeys(_source: Record<string, unknown>): Record<string, unknown> {
  throw new Error("Not implemented");
}

/** The reverse of flattenKeys. */
export function unflattenKeys(_source: Record<string, unknown>): Record<string, unknown> {
  throw new Error("Not implemented");
}
