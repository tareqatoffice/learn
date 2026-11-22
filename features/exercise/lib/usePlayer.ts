import { useCallback, useEffect, useReducer, useRef } from "react";
import type { PlanDay } from "../plan";

export type PlayerState = { phase: "work" | "rest" | "summary"; item: number; set: number; remaining: number };
export type PlayerEvent =
  | { type: "done" | "skip" | "back" | "tick" | "skipRest" }
  | { type: "addRest"; sec: number };
export type SetSave = { index: number; action: "done" | "skip" | "back" };

type Position = { item: number; set: number };

/** A work state at `at`; a timed item starts its clock. */
function workAt(plan: PlanDay, at: Position): PlayerState {
  const item = plan.items[at.item];
  if (!item) return { phase: "summary", item: plan.items.length, set: 0, remaining: 0 };
  return { phase: "work", item: at.item, set: at.set, remaining: item.seconds ?? 0 };
}

/** The set before `at`, or null at the very start. */
function previous(plan: PlanDay, at: Position): Position | null {
  if (at.set > 0) return { item: at.item, set: at.set - 1 };
  if (at.item > 0) return { item: at.item - 1, set: plan.items[at.item - 1].sets - 1 };
  return null;
}

function completeSet(plan: PlanDay, s: PlayerState): PlayerState {
  const item = plan.items[s.item];
  const next: Position = s.set + 1 < item.sets ? { item: s.item, set: s.set + 1 } : { item: s.item + 1, set: 0 };
  if (next.item >= plan.items.length) return workAt(plan, next);
  return { phase: "rest", ...next, remaining: item.restSec };
}

export function playerReducer(plan: PlanDay, s: PlayerState, e: PlayerEvent): PlayerState {
  if (s.phase === "summary") return s;
  switch (e.type) {
    case "done":
      return s.phase === "work" ? completeSet(plan, s) : s;
    case "skip":
      return s.phase === "work" ? workAt(plan, { item: s.item + 1, set: 0 }) : s;
    case "back": {
      const prev = previous(plan, s);
      return prev ? workAt(plan, prev) : s;
    }
    case "skipRest":
      return s.phase === "rest" ? workAt(plan, s) : s;
    case "addRest":
      return s.phase === "rest" ? { ...s, remaining: s.remaining + e.sec } : s;
    case "tick":
      if (s.phase === "rest") return s.remaining <= 1 ? workAt(plan, s) : { ...s, remaining: s.remaining - 1 };
      if (!plan.items[s.item].seconds) return s;
      return s.remaining <= 1 ? completeSet(plan, s) : { ...s, remaining: s.remaining - 1 };
  }
}

/** The change to persist for an event, naming the item it applies to; null when nothing is saved. */
export function saveFor(plan: PlanDay, s: PlayerState, e: PlayerEvent): SetSave | null {
  if (s.phase === "summary") return null;
  if (s.phase === "work") {
    if (e.type === "done" || e.type === "skip") return { index: s.item, action: e.type };
    if (e.type === "tick" && plan.items[s.item].seconds && s.remaining <= 1) return { index: s.item, action: "done" };
  }
  if (e.type === "back") {
    const prev = previous(plan, s);
    return prev ? { index: prev.item, action: "back" } : null;
  }
  return null;
}

export function usePlayer(
  plan: PlanDay,
  start: Position,
  onSave?: (save: SetSave) => void,
): PlayerState & { dispatch(e: PlayerEvent): void } {
  const [state, apply] = useReducer((s: PlayerState, e: PlayerEvent) => playerReducer(plan, s, e), start, (st) =>
    workAt(plan, st),
  );
  const current = useRef(state);

  const dispatch = useCallback(
    (e: PlayerEvent) => {
      const save = saveFor(plan, current.current, e);
      if (save) onSave?.(save);
      // Keep the ref in step synchronously so several events before a re-render still see each other.
      current.current = playerReducer(plan, current.current, e);
      apply(e);
    },
    [plan, onSave],
  );

  const ticking = state.phase === "rest" || (state.phase === "work" && Boolean(plan.items[state.item]?.seconds));
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, [ticking, state.item, state.set, state.phase, dispatch]);

  return { ...state, dispatch };
}
