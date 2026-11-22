import { describe, expect, it } from "vitest";
import { workoutPageMode } from "@/features/exercise/lib/pageMode";
import type { PlanDay } from "@/features/exercise/plan";
import type { SessionView } from "@/features/exercise/sessions";

const plan: PlanDay = { date: "2026-11-22", focus: "full", minutes: 20, items: [] };
const session = (status: SessionView["status"]): SessionView => ({ date: "2026-11-22", status, items: [] });

describe("workoutPageMode", () => {
  it("has nothing to show without a plan", () => {
    expect(workoutPageMode("2026-11-22", "2026-11-22", null, null)).toBe("none");
  });
  it("is missed for a past day without a done session", () => {
    expect(workoutPageMode("2026-11-20", "2026-11-22", plan, null)).toBe("missed");
    expect(workoutPageMode("2026-11-20", "2026-11-22", plan, session("inProgress"))).toBe("missed");
  });
  it("is a read-only preview for a future day", () => {
    expect(workoutPageMode("2026-11-24", "2026-11-22", plan, null)).toBe("preview");
  });
  it("is the player for today", () => {
    expect(workoutPageMode("2026-11-22", "2026-11-22", plan, null)).toBe("player");
    expect(workoutPageMode("2026-11-22", "2026-11-22", plan, session("inProgress"))).toBe("player");
  });
  it("is the summary for any done session", () => {
    expect(workoutPageMode("2026-11-22", "2026-11-22", plan, session("done"))).toBe("summary");
    expect(workoutPageMode("2026-11-20", "2026-11-22", plan, session("done"))).toBe("summary");
  });
});
