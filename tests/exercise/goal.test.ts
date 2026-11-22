import { describe, expect, it } from "vitest";
import {
  activityFactor, addMonths, ageFrom, bmr, calorieAdvice, goalLine, goalReached,
  paceCheck, paceStatus, safeTargetDate, weeklyPace, weeksBetween, type GoalShape,
} from "@/features/exercise/goal";

const g: GoalShape = { startDate: "2026-01-01", targetDate: "2026-04-11", startWeightKg: 90, goalWeightKg: 80 }; // 100 days
const today = "2026-02-20"; // day 50, line = 85

describe("pace maths", () => {
  it("weeksBetween / weeklyPace", () => {
    expect(weeksBetween("2026-01-01", "2026-01-15")).toBe(2);
    expect(weeklyPace(90, 80, 10)).toBe(-1);
    expect(weeklyPace(90, 80, 0)).toBe(0);
  });
  it("paceCheck", () => {
    expect(paceCheck(-0.8)).toBe("warn");
    expect(paceCheck(1.2)).toBe("block");
    expect(paceCheck(0.5)).toBe("ok");
    expect(paceCheck(-0.75)).toBe("ok");
    expect(paceCheck(1)).toBe("warn");
  });
  it("addMonths clamps to month end", () => {
    expect(addMonths("2026-11-22", 3)).toBe("2027-02-22");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-22", 2)).toBe("2027-01-22");
  });
  it("safeTargetDate", () => {
    expect(safeTargetDate("2026-11-22", 90, 80)).toBe("2027-02-22");
  });
  it("ageFrom", () => {
    expect(ageFrom(1990, "2026-11-22")).toBe(36);
  });
});

describe("calories", () => {
  it("bmr", () => {
    expect(bmr({ kg: 80, heightCm: 180, age: 30, sex: "male" })).toBe(1780);
    expect(bmr({ kg: 80, heightCm: 180, age: 30, sex: "female" })).toBe(1614);
    expect(bmr({ kg: 80, heightCm: 180, age: 30, sex: "unspecified" })).toBe(1697);
  });
  it("activityFactor", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(activityFactor)).toEqual([1.2, 1.2, 1.375, 1.375, 1.55, 1.55, 1.725, 1.725]);
  });
  it("calorieAdvice", () => {
    expect(calorieAdvice({ kg: 80, heightCm: 180, age: 30, sex: "male", daysPerWeek: 3, pace: -0.5 })).toBe(1900);
    expect(calorieAdvice({ kg: 50, heightCm: 155, age: 40, sex: "female", daysPerWeek: 6, pace: -1 })).toBe(1200);
    expect(calorieAdvice({ kg: 50, heightCm: 155, age: 40, sex: "male", daysPerWeek: 0, pace: -1 })).toBe(1500);
  });
});

describe("goal line and status", () => {
  it("goalLine is linear and clamped", () => {
    expect(goalLine(g, "2026-02-20")).toBe(85);
    expect(goalLine(g, "2025-12-01")).toBe(90);
    expect(goalLine(g, "2027-01-01")).toBe(80);
  });
  it("current weight selection", () => {
    expect(paceStatus(g, [], today).currentKg).toBe(90);
    expect(paceStatus(g, [{ date: "2026-02-01", kg: 88 }, { date: "2026-02-18", kg: 86 }], today).currentKg).toBe(86);
    const three = [
      { date: "2026-02-16", kg: 85 }, { date: "2026-02-18", kg: 86 }, { date: "2026-02-20", kg: 84 },
      { date: "2026-01-01", kg: 99 },
    ];
    expect(paceStatus(g, three, today).currentKg).toBe(85);
  });
  it("status vs line (loss)", () => {
    const at = (kg: number) => paceStatus(g, [{ date: today, kg }], today);
    expect(at(85.3).status).toBe("onPace");
    expect(at(84).status).toBe("ahead");
    const behind = at(86);
    expect(behind.status).toBe("behind");
    expect(behind.gapKg).toBe(1);
  });
  it("status vs line (gain)", () => {
    const gain: GoalShape = { ...g, startWeightKg: 60, goalWeightKg: 70 };
    expect(paceStatus(gain, [{ date: today, kg: 66 }], today).status).toBe("ahead");
    expect(paceStatus(gain, [{ date: today, kg: 64 }], today).status).toBe("behind");
  });
  it("goalReached", () => {
    expect(goalReached(g, 80)).toBe(true);
    expect(goalReached(g, 79)).toBe(true);
    expect(goalReached(g, 81)).toBe(false);
    expect(goalReached({ ...g, startWeightKg: 60, goalWeightKg: 70 }, 70.5)).toBe(true);
    expect(goalReached({ ...g, startWeightKg: 80 }, 80)).toBe(false);
  });
});
