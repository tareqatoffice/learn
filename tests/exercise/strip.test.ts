import { describe, expect, it } from "vitest";
import { stripDays } from "@/features/exercise/lib/strip";

describe("stripDays", () => {
  const base = { weekStart: "2026-11-02", plan: [], defaultMinutes: 30 };
  it("shows a done day as a workout even when the current profile does not plan it", () => {
    const days = stripDays({ ...base, planned: ["2026-11-06"], done: ["2026-11-02"] });
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ date: "2026-11-02", done: true, workout: { focus: "workout", minutes: 30 } });
    expect(days[1].workout).toBeUndefined();
    expect(days[4]).toMatchObject({ date: "2026-11-06", done: false, workout: { minutes: 30 } });
  });
  it("uses the stored plan's focus and minutes", () => {
    const days = stripDays({ ...base, plan: [{ date: "2026-11-04", focus: "core", minutes: 25 }], planned: ["2026-11-04"], done: [] });
    expect(days[2].workout).toEqual({ focus: "core", minutes: 25 });
  });
});
