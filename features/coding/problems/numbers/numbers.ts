/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Numbers
 *
 * Implement every export. No `any`.
 */

/** Limit `value` to the range [min, max]. */
export function clamp(_value: number, _min: number, _max: number): number {
  throw new Error("Not implemented");
}

/** Round to `places` decimals. 1.005 at 2 places must give 1.01. */
export function roundTo(_value: number, _places: number): number {
  throw new Error("Not implemented");
}

/** Numbers from `start` up to but excluding `end`, moving by `step`. Negative steps count down. Throw a RangeError for step 0. */
export function range(_start: number, _end: number, _step = 1): number[] {
  throw new Error("Not implemented");
}

/** Format with base 1024: 0 B, 1.5 KB, 2 MB. At most one decimal, trailing .0 removed. Units go up to TB. */
export function formatBytes(_bytes: number): string {
  throw new Error("Not implemented");
}
