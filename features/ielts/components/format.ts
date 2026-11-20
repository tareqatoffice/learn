import { CRITERION_LABEL, SKILLS, type Skill } from "@/features/ielts/bands";
import type { Adjustment, PhaseName } from "@/features/ielts/plan";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const dateLabel = (d: string) => DATE.format(new Date(`${d}T00:00:00Z`));
export const shortDate = (d: string) => SHORT.format(new Date(`${d}T00:00:00Z`));

export const bandLabel = (n: number) => n.toFixed(1);

export const SKILL_LABEL: Record<Skill, string> = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };
export const PHASE_LABEL: Record<PhaseName, string> = { foundation: "Foundation", skills: "Skill building", mocks: "Mocks and polish" };

export const weekMinutes = (m: Record<Skill, number>) => SKILLS.reduce((n, s) => n + m[s], 0);

export function hoursLabel(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function adjustmentLabel(a: Pick<Adjustment, "kind" | "criterion" | "share" | "minutes">): string {
  if (a.kind === "shiftCriterion") {
    const pct = Math.round((a.share ?? 0) * 100);
    return `Move ${pct}% of Speaking minutes to ${a.criterion ? CRITERION_LABEL[a.criterion] : "criterion"} drills`;
  }
  return `Spread ${a.minutes ?? 0} missed minutes over the remaining weeks`;
}
