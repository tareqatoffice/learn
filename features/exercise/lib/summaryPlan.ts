import type { PlanDay } from "../plan";
import type { SessionView } from "../sessions";

/** A finished workout is shown from the session's own items; targets come from the plan when it still lists the exercise. */
export function summaryPlan(plan: PlanDay, session: Pick<SessionView, "items">): PlanDay {
  return {
    ...plan,
    items: session.items.map(
      (s) => plan.items.find((p) => p.exerciseId === s.exerciseId) ?? { exerciseId: s.exerciseId, sets: s.setsDone, restSec: 0 },
    ),
  };
}
