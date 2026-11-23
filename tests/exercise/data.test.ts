import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { ExercisePlanWeek, ExerciseProfile, WeightEntry, WorkoutSession } from "@/models";
import { deleteAllExerciseData } from "@/features/exercise/data";
import { resetDb } from "../setup/mongo";

const profileDoc = (userId: Types.ObjectId, status: "active" | "ended") => ({
  userId,
  status,
  heightCm: 175,
  birthYear: 1990,
  sex: "male",
  level: "beginner",
  workoutDays: [1, 3, 5],
  minutesPerSession: 30,
  startWeightKg: 80,
  goalWeightKg: 72,
  startDate: "2026-11-01",
  targetDate: "2027-02-01",
});

describe("exercise data", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("allows one active profile per user but many ended", async () => {
    await Promise.all([ExerciseProfile.init(), ExercisePlanWeek.init(), WorkoutSession.init(), WeightEntry.init()]);
    const userId = new Types.ObjectId();
    await ExerciseProfile.create(profileDoc(userId, "ended"));
    await ExerciseProfile.create(profileDoc(userId, "ended"));
    await ExerciseProfile.create(profileDoc(userId, "active"));
    await expect(ExerciseProfile.create(profileDoc(userId, "active"))).rejects.toMatchObject({ code: 11000 });
  });

  it("deleteAllExerciseData removes only that user's rows", async () => {
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    for (const userId of [a, b]) {
      const profile = await ExerciseProfile.create(profileDoc(userId, "active"));
      const profileId = profile._id;
      await ExercisePlanWeek.create({ userId, profileId, weekStart: "2026-11-02", days: [], source: "code", coachNote: "" });
      await WorkoutSession.create({ userId, profileId, date: "2026-11-02", status: "done", items: [], startedAt: new Date() });
      await WeightEntry.create({ userId, profileId, date: "2026-11-02", kg: 79 });
    }
    await deleteAllExerciseData(String(a));
    for (const M of [ExerciseProfile, ExercisePlanWeek, WorkoutSession, WeightEntry]) {
      expect(await M.countDocuments({ userId: a })).toBe(0);
      expect(await M.countDocuments({ userId: b })).toBe(1);
    }
  });
});
