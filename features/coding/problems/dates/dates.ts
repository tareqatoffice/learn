/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Dates
 *
 * All dates are handled in UTC. Never mutate an input Date. No `any`.
 */

/** Return a new Date `days` later (or earlier when negative). */
export function addDays(_date: Date, _days: number): Date {
  throw new Error("Not implemented");
}

/** Whole UTC calendar days from `a` to `b`, negative when `b` is earlier. Time of day is ignored. */
export function diffInDays(_a: Date, _b: Date): number {
  throw new Error("Not implemented");
}

/** Gregorian leap year. */
export function isLeapYear(_year: number): boolean {
  throw new Error("Not implemented");
}

/** Format milliseconds as "H:MM:SS", or "M:SS" under an hour. Partial seconds are dropped. */
export function formatDuration(_ms: number): string {
  throw new Error("Not implemented");
}
