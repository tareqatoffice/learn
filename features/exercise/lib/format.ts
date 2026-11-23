import type { PlanItem } from "../plan";

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "15 reps" or "0:30". */
export function formatTarget(item: Pick<PlanItem, "reps" | "seconds">): string {
  return item.seconds ? formatClock(item.seconds) : `${item.reps ?? 0} reps`;
}
