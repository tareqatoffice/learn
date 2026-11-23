import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { ExercisePlanWeek, ExerciseProfile, WeightEntry, WorkoutSession } from "@/models";

export async function deleteAllExerciseData(userId: string): Promise<void> {
  if (!Types.ObjectId.isValid(userId)) return;
  await connectDb();
  await Promise.all([WorkoutSession, WeightEntry, ExercisePlanWeek, ExerciseProfile].map((M) => M.deleteMany({ userId })));
}
