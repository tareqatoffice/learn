import mongoose, { Schema, model } from "mongoose";
import {
  FOCUS_AREAS,
  FOCUS_DISTRACTIONS,
  FOCUS_LABEL_MAX,
  FOCUS_MAX_DRIFTS,
  FOCUS_MAX_SECONDS,
  FOCUS_MAX_TARGET_MINUTES,
  FOCUS_PATH_MAX,
  FOCUS_RATING_MAX,
  FOCUS_RATING_MIN,
  FOCUS_RUN_ID_MAX,
} from "@/models/focusConstants";

const focusSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    runId: { type: String, required: true, maxlength: FOCUS_RUN_ID_MAX },
    startedAt: { type: Date, required: true },
    date: { type: String, required: true },
    area: { type: String, enum: FOCUS_AREAS, required: true },
    label: { type: String, required: true, maxlength: FOCUS_LABEL_MAX },
    path: { type: String, required: true, maxlength: FOCUS_PATH_MAX },
    seconds: { type: Number, required: true, min: 1, max: FOCUS_MAX_SECONDS },
    targetMinutes: { type: Number, min: 1, max: FOCUS_MAX_TARGET_MINUTES },
    completed: { type: Boolean, default: false },
    drifts: { type: Number, min: 0, max: FOCUS_MAX_DRIFTS },
    rating: { type: Number, min: FOCUS_RATING_MIN, max: FOCUS_RATING_MAX },
    distraction: { type: String, enum: FOCUS_DISTRACTIONS },
  },
  { timestamps: true },
);

focusSessionSchema.index({ userId: 1, date: 1 });
focusSessionSchema.index({ userId: 1, runId: 1 }, { unique: true });

export const FocusSession = mongoose.models.FocusSession || model("FocusSession", focusSessionSchema);
