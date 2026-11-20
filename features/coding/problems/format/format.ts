/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Formatting
 *
 * Implement every export. Do not use Intl. No `any`.
 */

/** "1 item", "2 items". `plural` defaults to `singular + "s"`. 0 is plural. */
export function pluralize(_count: number, _singular: string, _plural?: string): string {
  throw new Error("Not implemented");
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 101st. */
export function ordinal(_n: number): string {
  throw new Error("Not implemented");
}

/** "a", "a and b", "a, b, and c". */
export function formatList(_items: readonly string[]): string {
  throw new Error("Not implemented");
}

/**
 * Describe `ms` relative to now, flooring to the largest unit: "just now" under
 * 1 minute, then "5 minutes ago", "1 hour ago", "2 days ago"; future values are
 * "in 5 minutes". Units are minute, hour and day.
 */
export function relativeTime(_ms: number): string {
  throw new Error("Not implemented");
}
