import type { PlanDay } from "../plan";
import type { SessionView } from "../sessions";

export type WorkoutPageMode = "player" | "summary" | "missed" | "preview" | "none";

/** Only today is playable; missed workouts are never made up and future days are read-only. */
export function workoutPageMode(
  date: string,
  today: string,
  plan: PlanDay | null,
  session: Pick<SessionView, "status"> | null,
): WorkoutPageMode {
  if (!plan) return "none";
  if (session?.status === "done") return "summary";
  if (date < today) return "missed";
  if (date > today) return "preview";
  return "player";
}
