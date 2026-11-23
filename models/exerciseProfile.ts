import mongoose, { Schema, model } from "mongoose";
import { LEVELS, SEXES } from "./exerciseConstants";

const exerciseProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    heightCm: { type: Number, required: true },
    birthYear: { type: Number, required: true },
    sex: { type: String, enum: SEXES, required: true },
    level: { type: String, enum: LEVELS, required: true },
    workoutDays: { type: [Number], default: [] },
    minutesPerSession: { type: Number, required: true },
    startWeightKg: { type: Number, required: true },
    goalWeightKg: { type: Number, required: true },
    startDate: { type: String, required: true },
    targetDate: { type: String, required: true },
    endedReason: { type: String, enum: ["replaced", "finished"] },
  },
  { timestamps: true },
);

exerciseProfileSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "active" } });

export const ExerciseProfile = mongoose.models.ExerciseProfile || model("ExerciseProfile", exerciseProfileSchema);
