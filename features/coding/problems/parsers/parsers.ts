/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Parsers
 *
 * Hand-written parsers only: no eval and no new Function. No `any`.
 */

/** Split one CSV line. Quoted fields may hold commas, and "" inside quotes is a literal quote. */
export function parseCsvLine(_line: string): string[] {
  throw new Error("Not implemented");
}

/** Evaluate reverse Polish notation with + - * / and spaces between tokens. Throw an Error on bad input. */
export function evalRpn(_input: string): number {
  throw new Error("Not implemented");
}

/** True when (), [] and {} nest correctly. Other characters are ignored. */
export function isBalanced(_input: string): boolean {
  throw new Error("Not implemented");
}

/** Replace {{ name }} and {{ a.b }} with values. Missing values become "". Inner spaces are optional. */
export function renderTemplate(_template: string, _data: Record<string, unknown>): string {
  throw new Error("Not implemented");
}
