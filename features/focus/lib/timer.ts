import { type FocusContext, isAppPath } from "@/features/focus/context";
import { FOCUS_AREAS, FOCUS_MAX_DRIFTS, FOCUS_MAX_SECONDS } from "@/models/focusConstants";

export type FocusRun = {
  id: string;
  firstStartedAt: number;
  context: FocusContext;
  targetMinutes?: number;
  elapsedMs: number;
  startedAt: number | null;
  awayAt?: number;
  drifts?: number;
};

export const AWAY_LIMIT_MS = 60_000;
export const MIN_DRIFT_MS = 3_000;
export const CHECKIN_MIN_SECONDS = 5 * 60;

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

export function backFromAway(run: FocusRun, now: number): { run: FocusRun; left: boolean; drifted: boolean } {
  if (run.awayAt === undefined) return { run, left: false, drifted: false };
  const { awayAt, ...rest } = run;
  const away = now - awayAt;
  if (away > AWAY_LIMIT_MS) return { run: pauseRun(rest, awayAt), left: true, drifted: false };
  if (away < MIN_DRIFT_MS) return { run: rest, left: false, drifted: false };
  return { run: { ...rest, drifts: Math.min((rest.drifts ?? 0) + 1, FOCUS_MAX_DRIFTS) }, left: false, drifted: true };
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
      !(v.awayAt === undefined || typeof v.awayAt === "number") ||
      !(v.drifts === undefined || (Number.isInteger(v.drifts) && v.drifts >= 0 && v.drifts <= FOCUS_MAX_DRIFTS))
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
      ...(v.drifts !== undefined && { drifts: v.drifts }),
    };
  } catch {
    return null;
  }
}
