import { TASKS, type TaskKey } from "./tasks";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar date (YYYY-MM-DD) of `now` in `timeZone`. */
export function localDate(now: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** The Sunday-first week containing `today`. */
export function weekDates(today: string): string[] {
  const sunday = addDays(today, -new Date(`${today}T00:00:00Z`).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

export type DayMinutes = Partial<Record<TaskKey, number>>;

/** Share of the day's target met: capped minutes over enabled tasks, divided by their total target. */
export function dayFraction(mins: DayMinutes, targets: Record<TaskKey, number>, enabled: Record<TaskKey, boolean>): number {
  let done = 0;
  let total = 0;
  for (const task of TASKS) {
    if (!enabled[task]) continue;
    total += targets[task];
    done += Math.min(mins[task] ?? 0, targets[task]);
  }
  return total > 0 ? done / total : 0;
}

export function taskDone(minutes: number, target: number): boolean {
  return minutes >= target;
}

/** Consecutive practised days ending today (or yesterday when today has none yet). */
export function streak(practised: Set<string>, today: string): number {
  let day = practised.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (practised.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export function longestStreak(practised: Set<string>): number {
  let best = 0;
  for (const day of practised) {
    if (practised.has(addDays(day, -1))) continue; // not the start of a run
    let len = 0;
    for (let d = day; practised.has(d); d = addDays(d, 1)) len++;
    best = Math.max(best, len);
  }
  return best;
}

const DEFAULT_CAP_SEC = 600;
const MAX_CAP_SEC = 900;

/** Longest take allowed: shadowing a known clip gets twice its length, up to 15 minutes; otherwise 10. */
export function takeCapSec(task: TaskKey, clipSec?: number): number {
  if (task === "shadowing" && clipSec && clipSec > 0) return Math.min(MAX_CAP_SEC, Math.round(clipSec * 2));
  return DEFAULT_CAP_SEC;
}

/** Upload size ceiling: 8 kB/s audio, 120 kB/s video. */
export function takeCapBytes(capSec: number, video: boolean): number {
  return capSec * (video ? 120_000 : 8_000);
}
