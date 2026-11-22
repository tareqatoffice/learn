import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { ExercisePlanWeek, ExerciseProfile } from "@/models";
import { finishIfDone, saveProfile } from "@/features/exercise/profile";
import { dayPlan, ensureWeek } from "@/features/exercise/weeks";
import { localDate } from "@/features/speaking/schedule";
import { resetDb } from "../setup/mongo";
import { newUserId } from "../progress/seed";

const profile = {
  heightCm: 175,
  birthYear: 1990,
  sex: "male" as const,
  level: "beginner" as const,
  workoutDays: [1, 3, 5],
  minutesPerSession: 30,
  startWeightKg: 80,
  goalWeightKg: 72,
  months: 3,
};

describe("ensureWeek", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([ExerciseProfile.init(), ExercisePlanWeek.init()]);
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("returns null without an active profile", async () => {
    expect(await ensureWeek(newUserId(), "2026-11-02")).toBeNull();
  });

  it("ensureWeek creates the current week once", async () => {
    const userId = newUserId();
    await saveProfile(userId, profile, "2026-11-02");
    const [a, b] = await Promise.all([ensureWeek(userId, "2026-11-04"), ensureWeek(userId, "2026-11-04")]);
    const c = await ensureWeek(userId, "2026-11-05");
    expect(await ExercisePlanWeek.countDocuments({ userId })).toBe(1);
    expect(a?.weekStart).toBe("2026-11-02");
    expect(a?.days.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-04", "2026-11-06"]);
    expect(a?.source).toBe("code");
    expect(b?.days).toEqual(a?.days);
    expect(c?.days).toEqual(a?.days);
    expect((await dayPlan(userId, "2026-11-04"))?.items.length).toBeGreaterThan(0);
    expect(await dayPlan(userId, "2026-11-03")).toBeNull();
  });

  it("uses the local date in UTC+6", async () => {
    const today = localDate(new Date("2026-11-22T23:30:00Z"), "Asia/Dhaka");
    expect(today).toBe("2026-11-23");
    const userId = newUserId();
    await saveProfile(userId, profile, today);
    expect((await ensureWeek(userId, today))?.weekStart).toBe("2026-11-23");
  });

  it("no week after the profile ends", async () => {
    const userId = newUserId();
    await saveProfile(userId, { ...profile, goalWeightKg: 77, months: 1 }, "2026-11-02");
    await finishIfDone(userId, "2026-12-10");
    expect(await ensureWeek(userId, "2026-12-10")).toBeNull();
    expect(await ExercisePlanWeek.countDocuments({ userId })).toBe(0);
  });
});
