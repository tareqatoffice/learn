import { addDays } from "@/features/speaking/schedule";
import type { PlanDay } from "../plan";
import type { StripDay } from "../components/WeekStrip";

/**
 * The seven days of a week for the home strip. A day with a done session always shows as a workout,
 * even if the current profile does not plan it (e.g. trained before a mid-week goal change).
 */
export function stripDays(p: {
  weekStart: string;
  plan: Pick<PlanDay, "date" | "focus" | "minutes">[];
  planned: string[];
  done: string[];
  defaultMinutes: number;
}): StripDay[] {
  const byDate = new Map(p.plan.map((d) => [d.date, d]));
  const planned = new Set(p.planned);
  const done = new Set(p.done);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(p.weekStart, i);
    const day = byDate.get(date);
    const isDone = done.has(date);
    return {
      date,
      done: isDone,
      ...(planned.has(date) || isDone ? { workout: { focus: day?.focus ?? "workout", minutes: day?.minutes ?? p.defaultMinutes } } : {}),
    };
  });
}
