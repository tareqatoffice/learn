/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: URLs
 *
 * Do not use URL or URLSearchParams, except in withQuery. No `any`.
 */

export type Query = Record<string, string | string[]>;

/** Parse "?a=1&b=2". Repeated keys become arrays. A key with no "=" has value "". Values are percent-decoded and "+" is a space. */
export function parseQuery(_search: string): Query {
  throw new Error("Not implemented");
}

/** The reverse of parseQuery with no leading "?". Keys are sorted and values are percent-encoded. Arrays repeat the key. */
export function stringifyQuery(_query: Query): string {
  throw new Error("Not implemented");
}

/** Join path segments with exactly one slash between them, keeping a leading and a trailing slash of the ends. */
export function joinPath(..._parts: readonly string[]): string {
  throw new Error("Not implemented");
}

/** Return `url` with the params set; `null` removes a param. Keeps other params and the hash. */
export function withQuery(_url: string, _params: Record<string, string | null>): string {
  throw new Error("Not implemented");
}
