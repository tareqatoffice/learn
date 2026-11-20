import { type FocusContext, isAppPath } from "@/features/focus/context";
import { FOCUS_AREAS, FOCUS_MAX_SECONDS } from "@/models/focusConstants";

/** A focus session in progress. Kept in localStorage so it survives navigation and reloads. */
export type FocusRun = {
  /** Unique per run; tabs and the server use it to tell runs apart. */
  id: string;
  /** Epoch ms the run was first started (the session's day comes from this). */
  firstStartedAt: number;
  context: FocusContext;
  /** Planned minutes; undefined = open-ended (counts up). */
  targetMinutes?: number;
  /** Time banked before the current running stretch. */
  elapsedMs: number;
  /** Epoch ms the current stretch started; null while paused. */
  startedAt: number | null;
};

export const FOCUS_STORAGE_KEY = "learn:focus:v1";
export const FOCUS_PRESETS = [15, 25, 50] as const;
/** Sessions shorter than this are dropped instead of saved. */
export const MIN_SAVE_SECONDS = 30;

export const startRun = (
  context: FocusContext,
  targetMinutes: number | undefined,
  now: number,
  id: string = crypto.randomUUID(),
): FocusRun => ({
  id,
  firstStartedAt: now,
  context,
  targetMinutes,
  elapsedMs: 0,
  startedAt: now,
});

export const isPaused = (run: FocusRun) => run.startedAt === null;

export function elapsedSeconds(run: FocusRun, now: number): number {
  const ms = run.elapsedMs + (run.startedAt === null ? 0 : Math.max(0, now - run.startedAt));
  const s = Math.floor(ms / 1000);
  const cap = run.targetMinutes ? run.targetMinutes * 60 : FOCUS_MAX_SECONDS;
  return Math.min(s, cap, FOCUS_MAX_SECONDS);
}

/** A timed run that reached its target counts as completed; an open-ended run never does. */
export const isCompleted = (run: FocusRun, now: number) =>
  run.targetMinutes !== undefined && remainingSeconds(run, now) === 0;

/** Seconds left for a timed run; null for open-ended runs. */
export const remainingSeconds = (run: FocusRun, now: number): number | null =>
  run.targetMinutes ? Math.max(0, run.targetMinutes * 60 - elapsedSeconds(run, now)) : null;

export const isDone = (run: FocusRun, now: number) =>
  run.targetMinutes ? remainingSeconds(run, now) === 0 : elapsedSeconds(run, now) >= FOCUS_MAX_SECONDS;

export function pauseRun(run: FocusRun, now: number): FocusRun {
  if (run.startedAt === null) return run;
  return { ...run, elapsedMs: run.elapsedMs + Math.max(0, now - run.startedAt), startedAt: null };
}

export const resumeRun = (run: FocusRun, now: number): FocusRun =>
  run.startedAt === null ? { ...run, startedAt: now } : run;

/** Reads a stored run, ignoring anything malformed. */
export function parseRun(raw: string | null): FocusRun | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<FocusRun>;
    const c = v.context;
    if (
      typeof v.id !== "string" ||
      !v.id ||
      typeof v.firstStartedAt !== "number" ||
      !c ||
      typeof c.label !== "string" ||
      typeof c.path !== "string" ||
      !isAppPath(c.path) ||
      !(FOCUS_AREAS as readonly string[]).includes(c.area as string) ||
      typeof v.elapsedMs !== "number" ||
      !(v.startedAt === null || typeof v.startedAt === "number") ||
      !(v.targetMinutes === undefined || typeof v.targetMinutes === "number")
    )
      return null;
    return {
      id: v.id,
      firstStartedAt: v.firstStartedAt,
      context: { area: c.area, label: c.label, path: c.path },
      targetMinutes: v.targetMinutes,
      elapsedMs: v.elapsedMs,
      startedAt: v.startedAt,
    };
  } catch {
    return null;
  }
}
