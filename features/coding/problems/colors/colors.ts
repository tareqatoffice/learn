/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Colors
 *
 * Implement every export. No `any`.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse "#rgb" or "#rrggbb", any case. Throw an Error for anything else. */
export function hexToRgb(_hex: string): Rgb {
  throw new Error("Not implemented");
}

/** Lower-case "#rrggbb". Channels are rounded and limited to 0 to 255. */
export function rgbToHex(_color: Rgb): string {
  throw new Error("Not implemented");
}

/** The WCAG contrast ratio of two hex colors, rounded to 2 decimals. */
export function contrastRatio(_a: string, _b: string): number {
  throw new Error("Not implemented");
}

/** Blend channels linearly: t = 0 gives `a`, t = 1 gives `b`. */
export function mixColors(_a: string, _b: string, _t: number): string {
  throw new Error("Not implemented");
}
