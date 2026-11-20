/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Deep operations
 *
 * Work recursively on plain objects and arrays. Do not use JSON or structuredClone. No `any`.
 */

/** Copy plain objects, arrays and Dates, including circular references. */
export function deepClone<T>(_value: T): T {
  throw new Error("Not implemented");
}

/** Compare by value. NaN equals NaN. Key order is ignored. Arrays never equal objects. */
export function deepEqual(_a: unknown, _b: unknown): boolean {
  throw new Error("Not implemented");
}

/** Merge `b` over `a`. Nested plain objects merge; arrays and other values replace. Ignore "__proto__" keys. */
export function deepMerge(_a: Record<string, unknown>, _b: Record<string, unknown>): Record<string, unknown> {
  throw new Error("Not implemented");
}

/** Freeze an object and everything inside it; handle circular references. Return the same object. */
export function deepFreeze<T>(_value: T): T {
  throw new Error("Not implemented");
}

/** List dotted paths whose values differ between `a` and `b`, sorted. Recurse into plain objects only. */
export function diffKeys(_a: Record<string, unknown>, _b: Record<string, unknown>): string[] {
  throw new Error("Not implemented");
}
