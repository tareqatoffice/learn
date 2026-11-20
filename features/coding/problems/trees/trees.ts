/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Trees
 *
 * Implement every export without mutating the input. No `any`.
 */

export interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];
}

export interface FlatNode<T> {
  id: number;
  parentId: number | null;
  value: T;
}

/** Values in depth-first, pre-order. */
export function flattenTree<T>(_root: TreeNode<T>): T[] {
  throw new Error("Not implemented");
}

/** Values grouped by depth, top level first. */
export function levels<T>(_root: TreeNode<T>): T[][] {
  throw new Error("Not implemented");
}

/** Build the forest from flat rows, in any input order, keeping sibling order. Throw an Error for an unknown parentId. */
export function buildTree<T>(_rows: readonly FlatNode<T>[]): TreeNode<T>[] {
  throw new Error("Not implemented");
}

/** The values from the root to the first node matching `test`, or null. */
export function findPath<T>(_root: TreeNode<T>, _test: (value: T) => boolean): T[] | null {
  throw new Error("Not implemented");
}

/** A new tree with `fn` applied to every value. */
export function mapTree<T, R>(_root: TreeNode<T>, _fn: (value: T) => R): TreeNode<R> {
  throw new Error("Not implemented");
}
