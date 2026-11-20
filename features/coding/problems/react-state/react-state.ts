/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: React State
 *
 * Custom hooks built on useState, useReducer and useRef. No `any`.
 */

/** Return [value, toggle, setValue]. `toggle` keeps the same identity across renders. */
export function useToggle(_initial = false): [boolean, () => void, (value: boolean) => void] {
  throw new Error("Not implemented");
}

export interface CounterOptions {
  initial?: number;
  min?: number;
  max?: number;
}

/** A counter kept inside [min, max]. Two increments in one batch must both count. `reset` returns to `initial`. */
export function useCounter(_options?: CounterOptions): { count: number; increment: () => void; decrement: () => void; reset: () => void } {
  throw new Error("Not implemented");
}

/** Return the value from the previous render: undefined on the first render. */
export function usePrevious<T>(_value: T): T | undefined {
  throw new Error("Not implemented");
}

/** A list managed with useReducer. `push`, `removeAt` and `clear` keep the same identity across renders. */
export function useList<T>(_initial: readonly T[]): { items: readonly T[]; push: (item: T) => void; removeAt: (index: number) => void; clear: () => void } {
  throw new Error("Not implemented");
}

/** State with history. `set` drops any redo entries. `undo` and `redo` do nothing when there is nothing to step to. */
export function useUndoRedo<T>(_initial: T): {
  value: T;
  set: (value: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  throw new Error("Not implemented");
}
