import { check, eq } from "../harness";
import type { Group } from "../harness";
import { combineReducers, createSelector, createStore, withHistory } from "./store";
import type { History, HistoryAction } from "./store";

type Action = "inc" | "noop";
const count = (state: number, action: Action): number => (action === "inc" ? state + 1 : state);
const start: History<number> = { past: [], present: 0, future: [] };
const apply: HistoryAction<Action> = { type: "APPLY", action: "inc" };

export const store: Group = {
  slug: "store",
  title: "State store",
  level: "Advanced",
  questions: [
    {
      name: "createStore",
      checks: [
        eq("Applies actions", () => {
          const s = createStore(count, 0);
          s.dispatch("inc");
          return s.getState();
        }, 1),
        eq("Notifies only on change", () => {
          let calls = 0;
          const s = createStore(count, 0);
          s.subscribe(() => calls++);
          s.dispatch("noop");
          s.dispatch("inc");
          return calls;
        }, 1),
        eq("Unsubscribe works", () => {
          let calls = 0;
          const s = createStore(count, 0);
          s.subscribe(() => calls++)();
          s.dispatch("inc");
          return calls;
        }, 0),
      ],
    },
    {
      name: "combineReducers",
      checks: [
        eq("Runs each slice", () => combineReducers<{ a: number; b: number }, Action>({ a: count, b: count })({ a: 0, b: 5 }, "inc"), { a: 1, b: 6 }),
        check("Keeps the reference when nothing changed", () => {
          const state = { a: 0 };
          return combineReducers<{ a: number }, Action>({ a: count })(state, "noop") === state || "returned a new object";
        }),
        check("Returns a new object on change", () => {
          const state = { a: 0 };
          return combineReducers<{ a: number }, Action>({ a: count })(state, "inc") !== state || "mutated the input";
        }),
      ],
    },
    {
      name: "createSelector",
      checks: [
        eq("Computes a value", () => createSelector((s: { n: number }) => s.n, (n) => n * 2)({ n: 2 }), 4),
        eq("Skips compute for equal input", () => {
          let runs = 0;
          const select = createSelector((s: { n: number }) => s.n, (n) => {
            runs++;
            return n;
          });
          select({ n: 1 });
          select({ n: 1 });
          return runs;
        }, 1),
        eq("Handles undefined as a first input", () => {
          let runs = 0;
          const select = createSelector((s: { n?: number }) => s.n, () => ++runs);
          select({});
          return select({});
        }, 1),
      ],
    },
    {
      name: "withHistory",
      checks: [
        eq("APPLY records history", () => withHistory(count)(start, apply), { past: [0], present: 1, future: [] }),
        eq("UNDO steps back", () => {
          const reduce = withHistory(count);
          return reduce(reduce(start, apply), { type: "UNDO" });
        }, { past: [], present: 0, future: [1] }),
        eq("REDO steps forward", () => {
          const reduce = withHistory(count);
          return reduce(reduce(reduce(start, apply), { type: "UNDO" }), { type: "REDO" });
        }, { past: [0], present: 1, future: [] }),
        eq("APPLY clears future", () => {
          const reduce = withHistory(count);
          return reduce(reduce(reduce(start, apply), { type: "UNDO" }), apply).future;
        }, []),
        check("UNDO at the start keeps state", () => withHistory(count)(start, { type: "UNDO" }) === start || "state changed"),
      ],
    },
  ],
};
