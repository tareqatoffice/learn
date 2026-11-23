import mongoose, { Schema, model } from "mongoose";
import { FOCUSES } from "./exerciseConstants";

const itemSchema = new Schema(
  {
    exerciseId: { type: String, required: true },
    sets: { type: Number, required: true },
    reps: Number,
    seconds: Number,
    restSec: { type: Number, required: true },
  },
  { _id: false },
);

const daySchema = new Schema(
  {
    date: { type: String, required: true },
    focus: { type: String, enum: FOCUSES, required: true },
    minutes: { type: Number, required: true },
    items: { type: [itemSchema], default: [] },
  },
  { _id: false },
);

const exercisePlanWeekSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    profileId: { type: Schema.Types.ObjectId, ref: "ExerciseProfile", required: true },
    weekStart: { type: String, required: true },
    days: { type: [daySchema], default: [] },
    source: { type: String, enum: ["ai", "code"], required: true },
    coachNote: { type: String, default: "" },
  },
  { timestamps: true },
);

exercisePlanWeekSchema.index({ profileId: 1, weekStart: 1 }, { unique: true });

export const ExercisePlanWeek = mongoose.models.ExercisePlanWeek || model("ExercisePlanWeek", exercisePlanWeekSchema);
