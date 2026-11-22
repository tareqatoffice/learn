import mongoose, { Schema, model } from "mongoose";
import { FEELS } from "./exerciseConstants";

const itemSchema = new Schema(
  {
    exerciseId: { type: String, required: true },
    setsDone: { type: Number, default: 0 },
    skipped: { type: Boolean, default: false },
    feel: { type: String, enum: FEELS },
  },
  { _id: false },
);

const workoutSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    profileId: { type: Schema.Types.ObjectId, ref: "ExerciseProfile", required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ["inProgress", "done", "abandoned"], default: "inProgress" },
    items: { type: [itemSchema], default: [] },
    startedAt: { type: Date, required: true },
    finishedAt: Date,
  },
  { timestamps: true },
);

workoutSessionSchema.index({ userId: 1, date: 1 }, { unique: true });

export const WorkoutSession = mongoose.models.WorkoutSession || model("WorkoutSession", workoutSessionSchema);
