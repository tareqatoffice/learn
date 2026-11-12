// Pure three-phase study plan generator. No DB, no clock: `today` comes in through the inputs.
// All dates are YYYY-MM-DD strings, compared lexically and read as UTC.

import { SKILLS, type Criterion, type Skill } from "@/ielts/bands";
import { addDays } from "@/speaking/schedule";

export type BandSet = { overall: number } & Partial<Record<Skill, number>>;

export type PlanInputs = {
  today: string;
  testDate: string;
  minutesPerDay: number;
  /** Weekdays, 0 = Sunday. */
  studyDays: number[];
  target: BandSet;
  current: Partial<BandSet>;
  currentUnknown: boolean;
};

/** Split values are percentages of the days left. */
export type PlanSettings = { hoursPerBand: number; split: { foundation: number; skills: number; mocks: number } };

/** As stored in `IeltsPlan.adjustments`. */
export type Adjustment = {
  id: string;
  kind: "shiftCriterion" | "spreadShortfall";
  criterion?: Criterion;
  share?: number;
  minutes?: number;
  fromWeek?: number;
  createdAt: Date;
};

export type PhaseName = "foundation" | "skills" | "mocks";
/** `start` and `end` are inclusive. */
export type Phase = { name: PhaseName; start: string; end: string };
export type Week = { start: string; end: string; minutes: Record<Skill, number>; mocks: number; focus?: Criterion };
export type Hours = { needed: number; available: number; short: boolean };
export type Plan = { phases: Phase[]; weeks: Week[]; hours: Hours; kept: Adjustment[]; dropped: Adjustment[] };

const MIN_MOCK_DAYS = 7;
const SHORT_PLAN_DAYS = 21;
const SHORT_SPLIT = { skills: 60, mocks: 40 };
const MIN_SKILL_SHARE = 0.15;
const MOCKS_PER_WEEK: Record<PhaseName, number> = { foundation: 0, skills: 1, mocks: 2 };

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Days from `from` to `to` (exclusive of `to`). */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Study days from `from` to `to`, both inclusive; 0 when `to` is before `from`. */
export function studyDaysBetween(from: string, to: string, studyDays: number[]): number {
  const days = new Set(studyDays);
  let count = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (days.has(weekday(d))) count++;
  return count;
}

function currentOverall(inputs: PlanInputs): number {
  return inputs.current.overall ?? inputs.target.overall - 1;
}

export function hoursCheck(inputs: PlanInputs, settings: PlanSettings): Hours {
  const needed = Math.max(inputs.target.overall - currentOverall(inputs), 0) * settings.hoursPerBand;
  const days = studyDaysBetween(inputs.today, addDays(inputs.testDate, -1), inputs.studyDays);
  const available = (days * inputs.minutesPerDay) / 60;
  return { needed, available, short: needed > available };
}

/**
 * Whole-day phases over `days`. Foundation and mocks each get round(days × share); mocks is then
 * raised to at least 7 days (never past the whole plan), and skills takes what is left. Under 21
 * days there is no foundation and the split is 60/40. Empty phases are left out.
 */
function phaseLengths(days: number, split: PlanSettings["split"]): [PhaseName, number][] {
  const short = days < SHORT_PLAN_DAYS;
  const mocksPct = short ? SHORT_SPLIT.mocks : split.mocks;
  const mocks = Math.min(days, Math.max(Math.round((days * mocksPct) / 100), MIN_MOCK_DAYS));
  const foundation = short ? 0 : Math.min(Math.round((days * split.foundation) / 100), days - mocks);
  const lengths: [PhaseName, number][] = [
    ["foundation", foundation],
    ["skills", days - foundation - mocks],
    ["mocks", mocks],
  ];
  return lengths.filter(([, n]) => n > 0);
}

/**
 * Share of weekly minutes per skill: w = 1 + max(target − current, 0), with a missing per-skill
 * figure taken from overall. Normalised, then any share under 15 % is raised to 15 % and the rest
 * rescaled to fill what remains (repeated until none is under).
 */
function skillWeights(inputs: PlanInputs): Record<Skill, number> {
  const cur = currentOverall(inputs);
  const raw = SKILLS.map((s) => 1 + Math.max((inputs.target[s] ?? inputs.target.overall) - (inputs.current[s] ?? cur), 0));
  const floored = new Set<number>();
  let shares = raw.map((w) => w / raw.reduce((a, b) => a + b, 0));
  for (;;) {
    const low = shares.findIndex((w, i) => !floored.has(i) && w < MIN_SKILL_SHARE);
    if (low < 0) break;
    floored.add(low);
    const free = 1 - floored.size * MIN_SKILL_SHARE;
    const freeRaw = raw.reduce((sum, w, i) => (floored.has(i) ? sum : sum + w), 0);
    shares = raw.map((w, i) => (floored.has(i) ? MIN_SKILL_SHARE : (w / freeRaw) * free));
  }
  return Object.fromEntries(SKILLS.map((s, i) => [s, shares[i]])) as Record<Skill, number>;
}

/** Rounds `amounts` (summing to the integer `whole`) to integers with the same sum, largest remainder first. */
function largestRemainder(amounts: number[], whole: number): number[] {
  const out = amounts.map((a) => Math.floor(a));
  let left = whole - out.reduce((a, b) => a + b, 0);
  const order = amounts.map((_, i) => i).sort((i, j) => amounts[j] - Math.floor(amounts[j]) - (amounts[i] - Math.floor(amounts[i])));
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k]]++;
  return out;
}

/**
 * Whole minutes per skill summing exactly to round(total). Every skill first gets
 * ceil(whole × 15 %); the rest is shared by each skill's weight above 15 % (which keeps the
 * weights' proportions, since the weights already include the floor), with largest-remainder
 * rounding. Ruling R7: when the week is too small for the floor (whole < 4 × ceil(whole × 15 %),
 * e.g. a week with no study days and only spread minutes), the floor is skipped and the minutes
 * are split by weight with largest remainder.
 */
function splitMinutes(total: number, weights: Record<Skill, number>): Record<Skill, number> {
  const whole = Math.round(total);
  const w = SKILLS.map((s) => weights[s]);
  const floor = Math.ceil(whole * MIN_SKILL_SHARE);
  let minutes: number[];
  if (whole < SKILLS.length * floor) {
    minutes = largestRemainder(w.map((x) => whole * x), whole);
  } else {
    const rest = whole - SKILLS.length * floor;
    const excess = w.map((x) => Math.max(x - MIN_SKILL_SHARE, 0));
    const excessSum = excess.reduce((a, b) => a + b, 0);
    const shares = excessSum > 0 ? excess.map((x) => x / excessSum) : w;
    minutes = largestRemainder(shares.map((x) => rest * x), rest).map((m) => m + floor);
  }
  return Object.fromEntries(SKILLS.map((s, i) => [s, minutes[i]])) as Record<Skill, number>;
}

/** The UTC calendar date an adjustment was created on. */
function createdDate(a: Adjustment): string {
  return new Date(a.createdAt).toISOString().slice(0, 10);
}

/**
 * Builds the plan over today..testDate−1.
 *
 * - Weeks are 7-day blocks from `today`; the last one is cut short at testDate−1 and its minutes
 *   come from its own (fewer) study days.
 * - A week's mocks come from the phase its first day falls in, capped at its study days. Week 0
 *   gets 1 diagnostic mock when it is a foundation week and the current band is unknown.
 * - `spreadShortfall` adds minutes / (weeks − fromWeek) to each week from `fromWeek` on, split by
 *   the skill weights. It is one-shot (ruling R12): kept only on the rebuild dated its creation
 *   day (UTC date of `createdAt` = `today`), and dropped on later rebuilds or when `fromWeek` is
 *   past the last week.
 * - `shiftCriterion` sets `focus` on the week containing its creation date (UTC) and every later
 *   week, in `createdAt` order so the newest shift wins; dropped when its criterion is in `metCriteria`.
 */
export function generatePlan(
  inputs: PlanInputs,
  adjustments: Adjustment[],
  settings: PlanSettings,
  ctx: { metCriteria?: Criterion[] } = {},
): Plan {
  const days = daysBetween(inputs.today, inputs.testDate);
  if (days < 0) throw new RangeError("test date has passed");
  if (days === 0) throw new RangeError("no days left before the test");
  const last = addDays(inputs.testDate, -1);

  const phases: Phase[] = [];
  let cursor = inputs.today;
  for (const [name, length] of phaseLengths(days, settings.split)) {
    phases.push({ name, start: cursor, end: addDays(cursor, length - 1) });
    cursor = addDays(cursor, length);
  }

  const weekCount = Math.ceil(days / 7);
  const kept: Adjustment[] = [];
  const dropped: Adjustment[] = [];
  const extra = new Array<number>(weekCount).fill(0);
  const shifts: Adjustment[] = [];
  const met = new Set(ctx.metCriteria ?? []);
  for (const a of adjustments) {
    if (a.kind === "spreadShortfall") {
      const from = Math.max(a.fromWeek ?? 0, 0);
      if (from >= weekCount || createdDate(a) !== inputs.today) {
        dropped.push(a);
        continue;
      }
      for (let i = from; i < weekCount; i++) extra[i] += (a.minutes ?? 0) / (weekCount - from);
      kept.push(a);
    } else {
      if (!a.criterion || met.has(a.criterion)) {
        dropped.push(a);
        continue;
      }
      shifts.push(a);
      kept.push(a);
    }
  }
  shifts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const weights = skillWeights(inputs);
  const weeks: Week[] = [];
  for (let i = 0; i < weekCount; i++) {
    const start = addDays(inputs.today, i * 7);
    const sixth = addDays(start, 6);
    const end = sixth < last ? sixth : last;
    const study = studyDaysBetween(start, end, inputs.studyDays);
    const phase = phases.find((p) => p.start <= start && start <= p.end)!.name;
    const diagnostic = i === 0 && phase === "foundation" && inputs.currentUnknown ? 1 : 0;
    const week: Week = {
      start,
      end,
      minutes: splitMinutes(study * inputs.minutesPerDay + extra[i], weights),
      mocks: Math.min(MOCKS_PER_WEEK[phase] + diagnostic, study),
    };
    for (const s of shifts) if (createdDate(s) <= end) week.focus = s.criterion;
    weeks.push(week);
  }

  return { phases, weeks, hours: hoursCheck(inputs, settings), kept, dropped };
}

export function phaseOn(plan: Pick<Plan, "phases">, date: string): Phase | null {
  return plan.phases.find((p) => p.start <= date && date <= p.end) ?? null;
}

export function weekOn(plan: Pick<Plan, "weeks">, date: string): { index: number; week: Week } | null {
  const index = plan.weeks.findIndex((w) => w.start <= date && date <= w.end);
  return index < 0 ? null : { index, week: plan.weeks[index] };
}
