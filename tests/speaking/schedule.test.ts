import { describe, expect, it } from "vitest";
import {
  addDays,
  dayFraction,
  localDate,
  longestStreak,
  streak,
  takeCapBytes,
  takeCapSec,
  taskDone,
  weekDates,
} from "@/speaking/schedule";
import { TASK_SLUG, taskFromSlug } from "@/speaking/tasks";

const T = { shadowing: 15, readAloud: 5, recordReview: 2 };
const E = { shadowing: true, readAloud: true, recordReview: true };

describe("speaking schedule", () => {
  it("computes the local date in a time zone", () => {
    expect(localDate(new Date("2026-11-10T19:30:00Z"), "Asia/Dhaka")).toBe("2026-11-11");
    expect(localDate(new Date("2026-11-11T04:30:00Z"), "America/New_York")).toBe("2026-11-10");
  });

  it("adds days and lists the week Sunday first", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(weekDates("2026-11-11")).toEqual([
      "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14",
    ]);
  });

  it("computes the day fraction over enabled tasks", () => {
    expect(dayFraction({ shadowing: 30, readAloud: 5 }, T, E)).toBeCloseTo(20 / 22);
    expect(dayFraction({ readAloud: 5 }, T, { ...E, shadowing: false })).toBeCloseTo(5 / 7);
    expect(dayFraction({}, T, { shadowing: false, readAloud: false, recordReview: false })).toBe(0);
  });

  it("decides when a task is done", () => {
    expect(taskDone(14.9, 15)).toBe(false);
    expect(taskDone(15, 15)).toBe(true);
  });

  it("counts streaks", () => {
    const d = new Set(["2026-11-08", "2026-11-09"]);
    expect(streak(d, "2026-11-10")).toBe(2);
    expect(streak(new Set([...d, "2026-11-10"]), "2026-11-10")).toBe(3);
    expect(streak(new Set(["2026-11-07"]), "2026-11-10")).toBe(0);
    expect(longestStreak(new Set(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-06"]))).toBe(3);
    expect(longestStreak(new Set())).toBe(0);
  });

  it("caps takes", () => {
    expect(takeCapSec("shadowing", 90)).toBe(180);
    expect(takeCapSec("shadowing")).toBe(600);
    expect(takeCapSec("shadowing", 1200)).toBe(900);
    expect(takeCapSec("readAloud")).toBe(600);
    expect(takeCapBytes(600, false)).toBe(4_800_000);
    expect(takeCapBytes(600, true)).toBe(72_000_000);
  });

  it("maps task slugs", () => {
    expect(taskFromSlug(TASK_SLUG.recordReview)).toBe("recordReview");
    expect(taskFromSlug("nope")).toBeNull();
  });
});
