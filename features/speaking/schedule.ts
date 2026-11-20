import { TASKS, type TaskKey } from "./tasks";

const DAY_MS = 24 * 60 * 60 * 1000;

export function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function weekDates(today: string): string[] {
  const sunday = addDays(today, -new Date(`${today}T00:00:00Z`).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

export type DayMinutes = Partial<Record<TaskKey, number>>;

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
    if (practised.has(addDays(day, -1))) continue;
    let len = 0;
    for (let d = day; practised.has(d); d = addDays(d, 1)) len++;
    best = Math.max(best, len);
  }
  return best;
}

const DEFAULT_CAP_SEC = 600;
const MAX_CAP_SEC = 900;

export function takeCapSec(task: TaskKey, clipSec?: number): number {
  if (task === "shadowing" && clipSec && clipSec > 0) return Math.min(MAX_CAP_SEC, Math.round(clipSec * 2));
  return DEFAULT_CAP_SEC;
}

export { capBytes as takeCapBytes } from "@/features/recording/mediaCore";
