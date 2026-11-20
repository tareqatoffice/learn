/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Validation
 *
 * Implement every export. No `any`.
 */

/** Exactly one "@", with a non-empty local part, a dot in the domain, no spaces. */
export function isEmail(_input: string): boolean {
  throw new Error("Not implemented");
}

/** Canonical UUID: 8-4-4-4-12 hex digits, any case. */
export function isUuid(_input: string): boolean {
  throw new Error("Not implemented");
}

/** Luhn checksum for a digit string; spaces are ignored. Other characters fail. */
export function isLuhn(_input: string): boolean {
  throw new Error("Not implemented");
}

export interface Rule {
  required?: boolean;
  minLength?: number;
  pattern?: RegExp;
}

/**
 * Return { field: firstFailingRule } in the order required, minLength, pattern,
 * using "required", "minLength" or "pattern" as the message. Missing or "" values
 * fail only `required`; if not required they pass everything.
 */
export function validate(_values: Record<string, string | undefined>, _rules: Record<string, Rule>): Record<string, string> {
  throw new Error("Not implemented");
}
