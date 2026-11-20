/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: React Patterns
 *
 * Context, external stores, refs and memoization. No `any`.
 */
import type { ReactNode, Ref } from "react";

/** Return [Provider, useValue]. useValue throws an Error naming `name` when there is no Provider. A falsy value is still a value. */
export function createStrictContext<T>(_name: string): [(props: { value: T; children: ReactNode }) => ReactNode, () => T] {
  throw new Error("Not implemented");
}

export interface ExternalStore<S> {
  getState: () => S;
  subscribe: (listener: () => void) => () => void;
}

/** Read a slice of `store` with useSyncExternalStore. A change elsewhere in the store must not re-render the caller. */
export function useStoreSelector<S, T>(_store: ExternalStore<S>, _selector: (state: S) => T): T {
  throw new Error("Not implemented");
}

/** Return a function with a stable identity that always calls the latest `fn`. */
export function useStableCallback<A extends unknown[], R>(_fn: (...args: A) => R): (...args: A) => R {
  throw new Error("Not implemented");
}

export interface FancyInputHandle {
  focus: () => void;
  clear: () => void;
}

/** An input that exposes only { focus, clear } on `ref` with useImperativeHandle. `ref` is a normal prop in React 19. */
export function FancyInput(_props: { ref?: Ref<FancyInputHandle>; defaultValue?: string }): ReactNode {
  throw new Error("Not implemented");
}

export interface RowProps {
  item: { id: number; label: string };
  onSelect: (id: number) => void;
  onRender: () => void;
}

/**
 * A memoized row. Call `onRender()` once in each render. Re-render only when `item.id`
 * or `item.label` changes, even if `item` is a new object or `onSelect` is a new function.
 */
export const Row = (_props: RowProps): ReactNode => {
  throw new Error("Not implemented");
};
