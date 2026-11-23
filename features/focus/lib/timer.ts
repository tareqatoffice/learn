import { type FocusContext, isAppPath } from "@/features/focus/context";
import { FOCUS_AREAS, FOCUS_MAX_SECONDS } from "@/models/focusConstants";

export type FocusRun = {
  id: string;
  firstStartedAt: number;
  context: FocusContext;
  targetMinutes?: number;
  elapsedMs: number;
  startedAt: number | null;
  /** When the site was last hidden (tab switched, app backgrounded, page closed); cleared on return. */
  awayAt?: number;
};

/** Away longer than this and the run stops at the moment you left. */
export const AWAY_LIMIT_MS = 60_000;

export const FOCUS_STORAGE_KEY = "learn:focus:v1";
export const FOCUS_PRESETS = [15, 25, 50] as const;
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

export const isCompleted = (run: FocusRun, now: number) =>
  run.targetMinutes !== undefined && remainingSeconds(run, now) === 0;

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

export const markAway = (run: FocusRun, now: number): FocusRun =>
  run.awayAt === undefined ? { ...run, awayAt: now } : run;

/** On return: a short absence keeps the run going; a long one stops it (paused) at the moment you left. */
export function backFromAway(run: FocusRun, now: number): { run: FocusRun; left: boolean } {
  if (run.awayAt === undefined) return { run, left: false };
  const { awayAt, ...rest } = run;
  if (now - awayAt > AWAY_LIMIT_MS) return { run: pauseRun(rest, awayAt), left: true };
  return { run: rest, left: false };
}

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
      !(v.targetMinutes === undefined || typeof v.targetMinutes === "number") ||
      !(v.awayAt === undefined || typeof v.awayAt === "number")
    )
      return null;
    return {
      id: v.id,
      firstStartedAt: v.firstStartedAt,
      context: { area: c.area, label: c.label, path: c.path },
      targetMinutes: v.targetMinutes,
      elapsedMs: v.elapsedMs,
      startedAt: v.startedAt,
      ...(v.awayAt !== undefined && { awayAt: v.awayAt }),
    };
  } catch {
    return null;
  }
}
