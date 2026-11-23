import { z } from "zod";
import { addDays } from "@/features/speaking/schedule";
import type { Focus, Level } from "@/models/exerciseConstants";
import { allowedFor, type Exercise } from "./catalog";

export type PlanItem = { exerciseId: string; sets: number; reps?: number; seconds?: number; restSec: number };
export type SkeletonDay = {
  date: string;
  focus: Focus;
  minutes: number;
  maxDifficulty: 1 | 2 | 3;
  slots: number;
  sets: number;
  restSec: number;
  reps: number;
  seconds: number;
};
export type PlanDay = { date: string; focus: Focus; minutes: number; items: PlanItem[] };
export type SkeletonInput = {
  level: Level;
  workoutDays: number[];
  minutesPerSession: number;
  startDate: string;
  targetDate: string;
  direction: "lose" | "gain" | "keep";
  /** Order of workout focuses (Admin → General settings); defaults to DEFAULT_ROTATION. */
  rotation?: readonly Focus[];
};

const LEVEL_DEFAULTS: Record<Level, { sets: number; restSec: number; maxDifficulty: 1 | 2 | 3 }> = {
  beginner: { sets: 2, restSec: 45, maxDifficulty: 1 },
  intermediate: { sets: 3, restSec: 35, maxDifficulty: 2 },
  advanced: { sets: 3, restSec: 25, maxDifficulty: 3 },
};
const BASE_VOLUME: Record<Level, { reps: number; seconds: number }> = {
  beginner: { reps: 8, seconds: 20 },
  intermediate: { reps: 12, seconds: 30 },
  advanced: { reps: 15, seconds: 40 },
};
export const DEFAULT_ROTATION: readonly Focus[] = ["full", "lower", "upper", "cardio", "core", "full"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const mondayFirst = (d: number) => (d + 6) % 7;

/** Monday of the week containing `date`. */
export function weekStartOf(date: string): string {
  return addDays(date, -mondayFirst(weekday(date)));
}

/** 0-based week number of `weekStart`, counted from the week holding `startDate`. */
export function weekIndex(startDate: string, weekStart: string): number {
  const ms = Date.parse(`${weekStart}T00:00:00Z`) - Date.parse(`${weekStartOf(startDate)}T00:00:00Z`);
  return Math.round(ms / WEEK_MS);
}

export function baseVolume(level: Level, weekIdx: number): { reps: number; seconds: number } {
  const base = BASE_VOLUME[level];
  const growth = 1.1 ** Math.max(0, weekIdx);
  return {
    reps: clamp(Math.round(base.reps * growth), 5, 30),
    seconds: clamp(Math.round(base.seconds * growth), 15, 60),
  };
}

export function scheduledDates(
  p: Pick<SkeletonInput, "workoutDays" | "startDate" | "targetDate">,
  from: string,
  to: string,
): string[] {
  const first = from > p.startDate ? from : p.startDate;
  const last = to < p.targetDate ? to : p.targetDate;
  const out: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (p.workoutDays.includes(weekday(d))) out.push(d);
  }
  return out;
}

function focusFor(
  position: number,
  count: number,
  direction: SkeletonInput["direction"],
  rotation: readonly Focus[] = DEFAULT_ROTATION,
): Focus {
  if (count >= 3 && position === count - 1) return "stretch";
  const order = rotation.length ? rotation : DEFAULT_ROTATION;
  const focus = order[position % order.length];
  return direction === "gain" && focus === "cardio" ? "full" : focus;
}

/** Upper bound on a day's length, used to trim volume when the minimum slot count overruns. */
function worstCaseSeconds(slots: number, sets: number, reps: number, seconds: number, restSec: number): number {
  return slots * (sets * Math.max(reps * 3, seconds) + (sets - 1) * restSec);
}

export function skeletonWeek(p: SkeletonInput, weekStart: string, history: { finishedRatio: number }): SkeletonDay[] {
  const idx = weekIndex(p.startDate, weekStart);
  const deload = idx >= 3 && (idx + 1) % 4 === 0;
  const defaults = LEVEL_DEFAULTS[p.level];
  const order = [...new Set(p.workoutDays)].sort((a, b) => mondayFirst(a) - mondayFirst(b));
  const bump = idx >= 4 && history.finishedRatio >= 0.8;
  const maxDifficulty = Math.min(3, defaults.maxDifficulty + (bump ? 1 : 0)) as 1 | 2 | 3;
  const restSec = defaults.restSec;
  let sets = deload ? Math.max(1, defaults.sets - 1) : defaults.sets;
  let { reps, seconds } = baseVolume(p.level, deload ? 0 : idx);

  const perItem = sets * Math.max(reps * 3, seconds) + (sets - 1) * restSec + 30;
  const slots = clamp(Math.floor((p.minutesPerSession * 60) / perItem), 3, 12);

  // The 3-slot minimum can overrun a short session; trim volume until it fits.
  while (worstCaseSeconds(slots, sets, reps, seconds, restSec) > p.minutesPerSession * 60) {
    if (reps > 5 || seconds > 15) {
      reps = Math.max(5, Math.floor(reps * 0.85));
      seconds = Math.max(15, Math.floor(seconds * 0.85));
    } else if (sets > 1) {
      sets -= 1;
    } else break;
  }

  const days: SkeletonDay[] = [];
  order.forEach((wd, position) => {
    const date = addDays(weekStart, mondayFirst(wd));
    if (date < p.startDate || date > p.targetDate) return;
    days.push({
      date,
      focus: focusFor(position, order.length, p.direction, p.rotation),
      minutes: p.minutesPerSession,
      maxDifficulty,
      slots,
      sets,
      restSec,
      reps,
      seconds,
    });
  });
  return days;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A day never repeats an exercise, so it holds at most as many items as there are allowed exercises. */
export function slotsFor(day: SkeletonDay, pool: readonly Exercise[]): number {
  return Math.min(day.slots, allowedFor(pool, day.focus, day.maxDifficulty).length);
}

export function fillDay(day: SkeletonDay, seed: string, pool: readonly Exercise[]): PlanDay {
  const shuffled = [...allowedFor(pool, day.focus, day.maxDifficulty)];
  const random = rng(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const items: PlanItem[] = shuffled
    .slice(0, slotsFor(day, pool))
    .map((ex) =>
      ex.mode === "time"
        ? { exerciseId: ex.id, sets: day.sets, seconds: day.seconds, restSec: day.restSec }
        : { exerciseId: ex.id, sets: day.sets, reps: day.reps, restSec: day.restSec },
    );
  return { date: day.date, focus: day.focus, minutes: day.minutes, items };
}

export function itemSeconds(i: PlanItem): number {
  return i.sets * (i.seconds ?? (i.reps ?? 0) * 3) + (i.sets - 1) * i.restSec;
}

const itemSchema = z
  .object({
    exerciseId: z.string(),
    sets: z.number().int().min(1).max(4),
    reps: z.number().int().min(5).max(30).optional(),
    seconds: z.number().int().min(15).max(60).optional(),
    restSec: z.number().int().min(0).max(180),
  })
  .refine((i) => i.reps !== undefined || i.seconds !== undefined);

export function validateDay(day: SkeletonDay, items: unknown, pool: readonly Exercise[]): PlanItem[] | null {
  const parsed = z.array(itemSchema).safeParse(items);
  if (!parsed.success) return null;
  const list = parsed.data;
  const allowedList = allowedFor(pool, day.focus, day.maxDifficulty);
  if (list.length < Math.max(1, slotsFor(day, pool) - 1) || list.length > Math.min(day.slots + 1, allowedList.length)) return null;
  if (new Set(list.map((i) => i.exerciseId)).size !== list.length) return null;
  const allowed = new Map(allowedList.map((e) => [e.id, e]));
  if (!list.every((i) => allowed.has(i.exerciseId))) return null;
  // Reps-mode moves take reps only, time-mode moves take seconds only.
  const fitsMode = (i: PlanItem) =>
    allowed.get(i.exerciseId)?.mode === "time" ? i.seconds !== undefined && i.reps === undefined : i.reps !== undefined && i.seconds === undefined;
  if (!list.every(fitsMode)) return null;
  const total = list.reduce((sum, i) => sum + itemSeconds(i), 0);
  if (total > day.minutes * 60 * 1.1) return null;
  return list;
}
