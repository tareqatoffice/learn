import type { Sex } from "@/models/exerciseConstants";
import { addDays } from "@/features/speaking/schedule";

const DAY_MS = 86_400_000;
const EPS = 1e-9;

const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;

export function weeksBetween(start: string, end: string): number {
  return (dayNumber(end) - dayNumber(start)) / 7;
}

export function weeklyPace(startKg: number, goalKg: number, weeks: number): number {
  return weeks <= 0 ? 0 : (goalKg - startKg) / weeks;
}

export function paceCheck(pace: number): "ok" | "warn" | "block" {
  const p = Math.abs(pace);
  if (p > 1 + EPS) return "block";
  if (p > 0.75 + EPS) return "warn";
  return "ok";
}

export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function safeTargetDate(start: string, startKg: number, goalKg: number): string {
  for (let m = 1; m < 600; m++) {
    const target = addMonths(start, m);
    if (Math.abs(weeklyPace(startKg, goalKg, weeksBetween(start, target))) <= 1 + EPS) return target;
  }
  return addMonths(start, 600);
}

/** The earliest safe target date within `maxMonths`, or null when the goal needs longer than that. */
export function safeTargetWithin(start: string, startKg: number, goalKg: number, maxMonths = 24): string | null {
  const safe = safeTargetDate(start, startKg, goalKg);
  return safe <= addMonths(start, maxMonths) ? safe : null;
}

export const TOO_FAR = "That goal needs more than 24 months at a safe pace. Pick a goal closer to your current weight.";

export function ageFrom(birthYear: number, today: string): number {
  return Number(today.slice(0, 4)) - birthYear;
}

const SEX_OFFSET: Record<Sex, number> = { male: 5, female: -161, unspecified: -78 };

export function bmr(p: { kg: number; heightCm: number; age: number; sex: Sex }): number {
  return 10 * p.kg + 6.25 * p.heightCm - 5 * p.age + SEX_OFFSET[p.sex];
}

export function activityFactor(daysPerWeek: number): number {
  if (daysPerWeek >= 6) return 1.725;
  if (daysPerWeek >= 4) return 1.55;
  if (daysPerWeek >= 2) return 1.375;
  return 1.2;
}

export function calorieAdvice(p: {
  kg: number; heightCm: number; age: number; sex: Sex; daysPerWeek: number; pace: number;
}): number {
  const kcal = bmr(p) * activityFactor(p.daysPerWeek) + (p.pace * 7700) / 7;
  const floor = p.sex === "female" ? 1200 : 1500;
  return Math.max(floor, Math.round(kcal / 50) * 50);
}

export type GoalShape = { startDate: string; targetDate: string; startWeightKg: number; goalWeightKg: number };

export function goalLine(g: GoalShape, date: string): number {
  const total = dayNumber(g.targetDate) - dayNumber(g.startDate);
  if (total <= 0) return g.goalWeightKg;
  const t = Math.min(1, Math.max(0, (dayNumber(date) - dayNumber(g.startDate)) / total));
  return g.startWeightKg + (g.goalWeightKg - g.startWeightKg) * t;
}

export type PaceStatus = {
  status: "onPace" | "ahead" | "behind" | "above" | "below";
  currentKg: number;
  gapKg: number;
  /** Keep-fit goal (start equals goal): "above"/"below" the goal replace "ahead"/"behind". */
  keep?: true;
};

export function paceLabel(s: Pick<PaceStatus, "status" | "gapKg" | "keep">): string {
  if (s.status === "onPace") return s.keep ? "On target" : "On pace";
  if (s.status === "ahead") return `Ahead by ${s.gapKg} kg`;
  if (s.status === "behind") return `Behind by ${s.gapKg} kg`;
  return `${s.gapKg} kg ${s.status} goal`;
}

export function paceStatus(
  g: GoalShape,
  weights: { date: string; kg: number }[],
  today: string,
): PaceStatus {
  const from = addDays(today, -6);
  const recent = weights.filter((w) => w.date >= from && w.date <= today);
  let currentKg = g.startWeightKg;
  if (recent.length >= 3) {
    currentKg = recent.reduce((s, w) => s + w.kg, 0) / recent.length;
  } else if (weights.length > 0) {
    currentKg = weights.reduce((a, b) => (b.date >= a.date ? b : a)).kg;
  }
  const diff = currentKg - goalLine(g, today);
  const dir = Math.sign(g.goalWeightKg - g.startWeightKg);
  const gapKg = Math.round(Math.abs(diff) * 10) / 10;
  const keep = dir === 0;
  if (Math.abs(diff) <= 0.5 + EPS) return { status: "onPace", currentKg, gapKg, ...(keep ? { keep: true as const } : {}) };
  if (keep) return { status: diff > 0 ? "above" : "below", currentKg, gapKg, keep: true };
  return { status: diff * dir > 0 ? "ahead" : "behind", currentKg, gapKg };
}

export function goalReached(g: GoalShape, currentKg: number): boolean {
  const dir = Math.sign(g.goalWeightKg - g.startWeightKg);
  if (dir === 0) return false;
  return (currentKg - g.goalWeightKg) * dir >= 0;
}
