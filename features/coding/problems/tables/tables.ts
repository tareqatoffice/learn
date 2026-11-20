/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Table logic
 *
 * Data helpers behind a table UI. No `any`.
 */

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

/** Return a 1-based page. `page` is clamped to the valid range. An empty list has one empty page. */
export function paginate<T>(_items: readonly T[], _page: number, _perPage: number): Page<T> {
  throw new Error("Not implemented");
}

/** Page buttons: always the first and last page and the pages next to `current`; "..." fills gaps of 2 or more pages, and a gap of 1 shows that page. */
export function paginationRange(_current: number, _total: number): (number | "...")[] {
  throw new Error("Not implemented");
}

/** Sum `getValue` per `getKey`. */
export function sumBy<T>(_rows: readonly T[], _getKey: (row: T) => string, _getValue: (row: T) => number): Record<string, number> {
  throw new Error("Not implemented");
}

/** Build { rowKey: { columnKey: sum } }. */
export function pivot<T>(
  _rows: readonly T[],
  _getRow: (row: T) => string,
  _getColumn: (row: T) => string,
  _getValue: (row: T) => number,
): Record<string, Record<string, number>> {
  throw new Error("Not implemented");
}
