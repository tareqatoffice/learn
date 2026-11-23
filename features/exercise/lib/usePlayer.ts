import { useCallback, useEffect, useReducer, useRef } from "react";
import type { PlanDay } from "../plan";

export type PlayerState = {
  phase: "work" | "rest" | "summary";
  item: number;
  set: number;
  remaining: number;
  done: number[];
  skipped: boolean[];
};
export type PlayerEvent =
  | { type: "done" | "skip" | "back" | "tick" | "skipRest" }
  | { type: "addRest"; sec: number };
export type SetSave = { index: number; action: "done" | "skip" | "back" };
export type PlayerStart = { item: number; set: number; items?: { setsDone: number; skipped: boolean }[] };

type Progress = Pick<PlayerState, "done" | "skipped">;

function resume(plan: PlanDay, p: Progress): { item: number; set: number } | null {
  for (let i = 0; i < plan.items.length; i++) {
    if (!p.skipped[i] && p.done[i] < plan.items[i].sets) return { item: i, set: p.done[i] };
  }
  return null;
}

function workFrom(plan: PlanDay, p: Progress): PlayerState {
  const at = resume(plan, p);
  if (!at) return { phase: "summary", item: plan.items.length, set: 0, remaining: 0, ...p };
  return { phase: "work", ...at, remaining: plan.items[at.item].seconds ?? 0, ...p };
}

export function initialPlayerState(plan: PlanDay, start: PlayerStart): PlayerState {
  const done = plan.items.map((it, i) =>
    start.items ? (start.items[i]?.setsDone ?? 0) : i < start.item ? it.sets : i === start.item ? start.set : 0,
  );
  const skipped = plan.items.map((_, i) => start.items?.[i]?.skipped ?? false);
  return workFrom(plan, { done, skipped });
}

function backTarget(s: PlayerState): number | null {
  if (s.phase === "summary") return null;
  if (s.set > 0) return s.item;
  return s.item > 0 ? s.item - 1 : null;
}

function completeSet(plan: PlanDay, s: PlayerState): PlayerState {
  const done = s.done.map((n, i) => (i === s.item ? Math.min(plan.items[i].sets, n + 1) : n));
  const next = workFrom(plan, { done, skipped: s.skipped });
  if (next.phase === "summary") return next;
  return { ...next, phase: "rest", remaining: plan.items[s.item].restSec };
}

export function playerReducer(plan: PlanDay, s: PlayerState, e: PlayerEvent): PlayerState {
  if (s.phase === "summary") return s;
  switch (e.type) {
    case "done":
      return s.phase === "work" ? completeSet(plan, s) : s;
    case "skip":
      return s.phase === "work"
        ? workFrom(plan, { done: s.done, skipped: s.skipped.map((k, i) => k || i === s.item) })
        : s;
    case "back": {
      const target = backTarget(s);
      if (target === null) return s;
      return workFrom(plan, {
        done: s.done.map((n, i) => (i === target ? Math.max(0, n - 1) : n)),
        skipped: s.skipped.map((k, i) => k && i !== target),
      });
    }
    case "skipRest":
      return s.phase === "rest" ? { ...s, phase: "work", remaining: plan.items[s.item].seconds ?? 0 } : s;
    case "addRest":
      return s.phase === "rest" ? { ...s, remaining: s.remaining + e.sec } : s;
    case "tick":
      if (s.phase === "rest") {
        return s.remaining <= 1
          ? { ...s, phase: "work", remaining: plan.items[s.item].seconds ?? 0 }
          : { ...s, remaining: s.remaining - 1 };
      }
      if (!plan.items[s.item].seconds) return s;
      return s.remaining <= 1 ? completeSet(plan, s) : { ...s, remaining: s.remaining - 1 };
  }
}

export function saveFor(plan: PlanDay, s: PlayerState, e: PlayerEvent): SetSave | null {
  if (s.phase === "summary") return null;
  if (s.phase === "work") {
    if (e.type === "done" || e.type === "skip") return { index: s.item, action: e.type };
    if (e.type === "tick" && plan.items[s.item].seconds && s.remaining <= 1) return { index: s.item, action: "done" };
  }
  if (e.type === "back") {
    const target = backTarget(s);
    return target === null ? null : { index: target, action: "back" };
  }
  return null;
}

export function usePlayer(
  plan: PlanDay,
  start: PlayerStart,
  onSave?: (save: SetSave) => void,
): PlayerState & { dispatch(e: PlayerEvent): void } {
  const [state, apply] = useReducer((s: PlayerState, e: PlayerEvent) => playerReducer(plan, s, e), start, (st) =>
    initialPlayerState(plan, st),
  );
  const current = useRef(state);

  const dispatch = useCallback(
    (e: PlayerEvent) => {
      const save = saveFor(plan, current.current, e);
      if (save) onSave?.(save);
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
