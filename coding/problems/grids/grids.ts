/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Grids
 *
 * A grid is an array of rows. Return new grids; never mutate the input. No `any`.
 */

/** Swap rows and columns. */
export function transpose<T>(_grid: readonly (readonly T[])[]): T[][] {
  throw new Error("Not implemented");
}

/** Rotate 90 degrees clockwise. */
export function rotate<T>(_grid: readonly (readonly T[])[]): T[][] {
  throw new Error("Not implemented");
}

/** Values in clockwise spiral order, from the top-left. */
export function spiral<T>(_grid: readonly (readonly T[])[]): T[] {
  throw new Error("Not implemented");
}

/** Replace the 4-connected region around (row, col) with `value`. */
export function floodFill<T>(_grid: readonly (readonly T[])[], _row: number, _col: number, _value: T): T[][] {
  throw new Error("Not implemented");
}
