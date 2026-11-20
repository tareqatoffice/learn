/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: State store
 *
 * Build small Redux-style pieces. No `any`.
 */

export type Reducer<S, A> = (state: S, action: A) => S;

export interface Store<S, A> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: () => void): () => void;
}

/** Hold state; `dispatch` runs the reducer and notifies listeners only when the state reference changed. */
export function createStore<S, A>(_reducer: Reducer<S, A>, _initial: S): Store<S, A> {
  throw new Error("Not implemented");
}

/** Combine slice reducers. Return the same state object when no slice changed. */
export function combineReducers<S extends object, A>(_reducers: { [K in keyof S]: Reducer<S[K], A> }): Reducer<S, A> {
  throw new Error("Not implemented");
}

/** Memoize: rerun `compute` only when `select(state)` changes by Object.is. */
export function createSelector<S, I, R>(_select: (state: S) => I, _compute: (input: I) => R): (state: S) => R {
  throw new Error("Not implemented");
}

export interface History<S> {
  past: S[];
  present: S;
  future: S[];
}

export type HistoryAction<A> = { type: "UNDO" } | { type: "REDO" } | { type: "APPLY"; action: A };

/** Add undo and redo to a reducer. APPLY clears `future`, and adds to history only when state changed. UNDO and REDO do nothing at the ends. */
export function withHistory<S, A>(_reducer: Reducer<S, A>): Reducer<History<S>, HistoryAction<A>> {
  throw new Error("Not implemented");
}
