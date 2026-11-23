import mongoose, { Schema, model } from "mongoose";
import { DIFFICULTIES, EXERCISE_MODES, EXERCISE_TYPES, FOCUSES } from "./exerciseConstants";

/** One move in the exercise library. `slug` is the id plans and sessions store, so it never changes. */
const exerciseSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    focus: { type: [{ type: String, enum: FOCUSES }], default: [] },
    type: { type: String, enum: EXERCISE_TYPES, required: true },
    difficulty: { type: Number, enum: DIFFICULTIES, required: true },
    mode: { type: String, enum: EXERCISE_MODES, required: true },
    equipment: { type: String, default: "none" },
    cues: { type: [String], default: [] },
    /** R2 object keys for the start and end photos ("" when missing). */
    startPhoto: { type: String, default: "" },
    endPhoto: { type: String, default: "" },
    /** Archived moves stay readable for old workouts but are no longer planned or listed. */
    archived: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

exerciseSchema.index({ order: 1, name: 1 });

export const Exercise = mongoose.models.Exercise || model("Exercise", exerciseSchema);
