import { addDays } from "@/features/speaking/schedule";
import type { FocusDistraction } from "@/models/focusConstants";

export type HabitSession = {
  date: string;
  seconds: number;
  completed?: boolean;
  targetMinutes?: number;
  rating?: number;
  distraction?: FocusDistraction;
  drifts?: number;
};

export const DEFAULT_BLOCK_MINUTES = 25;
export const MAX_BLOCK_MINUTES = 90;
export const MIN_BLOCK_MINUTES = 10;
export const RAMP_STEP_MINUTES = 5;
export const REMIND_WINDOW_MINUTES = 20;

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

export function weekStartOf(date: string): string {
  const mondayFirst = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -mondayFirst);
}

export type Streak = {
  days: number;
  alive: boolean;
  lastActive: string | null;
  doneToday: boolean;
  atRisk: boolean;
};

export function streakOf(dates: string[], today: string): Streak {
  const sorted = [...new Set(dates.filter((d) => d <= today))].sort().reverse();
  const none: Streak = { days: 0, alive: false, lastActive: sorted[0] ?? null, doneToday: false, atRisk: false };
  if (!sorted.length) return none;
  const gap = daysBetween(sorted[0], today);
  if (gap > 2) return none;
  let days = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i], sorted[i - 1]) > 2) break;
    days++;
  }
  return { days, alive: true, lastActive: sorted[0], doneToday: gap === 0, atRisk: gap === 2 };
}

export type WeekSummary = {
  weekStart: string;
  days: { date: string; seconds: number }[];
  totalSeconds: number;
  sessions: number;
  avgRating: number | null;
  ratedSessions: number;
  topDistraction: FocusDistraction | null;
  drifts: number;
};

export function weekSummary(sessions: HabitSession[], weekStart: string): WeekSummary {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const inWeek = sessions.filter((s) => s.date >= dates[0] && s.date <= dates[6]);
  const days = dates.map((date) => ({
    date,
    seconds: inWeek.filter((s) => s.date === date).reduce((n, s) => n + s.seconds, 0),
  }));
  const ratings = inWeek.map((s) => s.rating).filter((r): r is number => typeof r === "number");
  const counts = new Map<FocusDistraction, number>();
  for (const s of inWeek) if (s.distraction) counts.set(s.distraction, (counts.get(s.distraction) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  return {
    weekStart,
    days,
    totalSeconds: days.reduce((n, d) => n + d.seconds, 0),
    sessions: inWeek.length,
    avgRating: ratings.length ? Math.round((ratings.reduce((n, r) => n + r, 0) / ratings.length) * 10) / 10 : null,
    ratedSessions: ratings.length,
    topDistraction: top ? top[0] : null,
    drifts: inWeek.reduce((n, s) => n + (s.drifts ?? 0), 0),
  };
}

export type BlockSuggestion = { minutes: number; direction: "up" | "same" | "down"; reason: string };

export function suggestBlock(sessions: HabitSession[], today: string): BlockSuggestion {
  const since = addDays(today, -6);
  const recent = sessions.filter((s) => s.date >= since && s.date <= today);
  const withTarget = sessions
    .filter((s) => s.targetMinutes !== undefined && s.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const base = withTarget[0]?.targetMinutes ?? DEFAULT_BLOCK_MINUTES;
  const completed = recent.filter((s) => s.completed).length;
  const ratings = recent.map((s) => s.rating).filter((r): r is number => typeof r === "number");
  const avg = ratings.length ? ratings.reduce((n, r) => n + r, 0) / ratings.length : null;

  if (completed >= 3 && (avg === null || avg >= 4) && base < MAX_BLOCK_MINUTES) {
    return {
      minutes: Math.min(MAX_BLOCK_MINUTES, base + RAMP_STEP_MINUTES),
      direction: "up",
      reason: `You finished ${completed} blocks in the last 7 days${avg === null ? "" : ` with focus averaging ${avg.toFixed(1)}`}. Add ${RAMP_STEP_MINUTES} minutes.`,
    };
  }
  if (ratings.length >= 2 && avg !== null && avg <= 2 && base > MIN_BLOCK_MINUTES) {
    return {
      minutes: Math.max(MIN_BLOCK_MINUTES, base - RAMP_STEP_MINUTES),
      direction: "down",
      reason: `Focus averaged ${avg.toFixed(1)} this week. A shorter block you finish beats a long one you drop.`,
    };
  }
  return {
    minutes: base,
    direction: "same",
    reason:
      completed >= 3
        ? `Hold at ${base} minutes until your focus rating averages 4 or more.`
        : `Finish 3 blocks in a week at ${base} minutes, then add ${RAMP_STEP_MINUTES}.`,
  };
}

const minutesOfDay = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function shouldRemind(
  plan: { time: string; enabled: boolean } | null,
  now: { date: string; hhmm: string },
  lastShown: string | null,
): boolean {
  if (!plan?.enabled || lastShown === now.date) return false;
  const since = (minutesOfDay(now.hhmm) - minutesOfDay(plan.time) + 1440) % 1440;
  return since < REMIND_WINDOW_MINUTES;
}

export function localClock(now: Date): { date: string; hhmm: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
    hhmm: `${p(now.getHours())}:${p(now.getMinutes())}`,
  };
}
