import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { Exercise, ExercisePlanWeek, ExerciseProfile, WorkoutSession } from "@/models";
import { EXERCISE_MAP, seedExercises } from "./fixtures";
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
  beforeEach(async () => {
    await resetDb();
    await seedExercises();
  });
  afterAll(() => mongoose.disconnect());

  it("returns null without an active profile", async () => {
    expect(await ensureWeek(newUserId(), "2026-11-02")).toBeNull();
  });

  it("stores no week while the exercise library is empty", async () => {
    const userId = newUserId();
    await saveProfile(userId, profile, "2026-11-02");
    await Exercise.deleteMany({});
    expect(await ensureWeek(userId, "2026-11-04")).toBeNull();
    expect(await ExercisePlanWeek.countDocuments({ userId })).toBe(0);
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

  it("a direct link in a new week finds its plan once ensureWeek has run", async () => {
    const userId = newUserId();
    await saveProfile(userId, profile, "2026-11-02");
    expect(await dayPlan(userId, "2026-11-09")).toBeNull();
    await ensureWeek(userId, "2026-11-09");
    expect(await dayPlan(userId, "2026-11-09")).not.toBeNull();
  });

  it("last week's finished ratio uses the stored plan's dates, not the current schedule", async () => {
    const userId = newUserId();
    const saved = await saveProfile(userId, profile, "2026-11-02");
    if (!saved.ok) throw new Error("save failed");
    // Last week had only two planned days (a stored plan), and both were done: ratio 1, not 2/3.
    await ExercisePlanWeek.create({
      userId,
      profileId: saved.id,
      weekStart: "2026-11-23",
      days: ["2026-11-23", "2026-11-25"].map((date) => ({
        date,
        focus: "full",
        minutes: 30,
        items: [{ exerciseId: "push-up", sets: 2, reps: 8, restSec: 45 }],
      })),
      source: "code",
      coachNote: "",
    });
    for (const date of ["2026-11-23", "2026-11-25"]) {
      await WorkoutSession.create({ userId, profileId: saved.id, date, status: "done", items: [], startedAt: new Date() });
    }
    const week = await ensureWeek(userId, "2026-11-30");
    const levels = (week?.days ?? []).flatMap((d) => d.items.map((i) => EXERCISE_MAP[i.exerciseId]?.difficulty ?? 0));
    expect(Math.max(...levels)).toBe(2); // beginner (1) bumped to 2 by a >= 0.8 ratio
  });
});
