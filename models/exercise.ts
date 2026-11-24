import mongoose, { Schema, model } from "mongoose";
import { DIFFICULTIES, EXERCISE_MODES, EXERCISE_TYPES, FOCUSES } from "./exerciseConstants";

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
    startPhoto: { type: String, default: "" },
    endPhoto: { type: String, default: "" },
    archived: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

exerciseSchema.index({ order: 1, name: 1 });

export const Exercise = mongoose.models.Exercise || model("Exercise", exerciseSchema);
