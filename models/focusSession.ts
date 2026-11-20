import mongoose, { Schema, model } from "mongoose";
import {
  FOCUS_AREAS,
  FOCUS_LABEL_MAX,
  FOCUS_MAX_SECONDS,
  FOCUS_MAX_TARGET_MINUTES,
  FOCUS_PATH_MAX,
  FOCUS_RUN_ID_MAX,
} from "@/models/focusConstants";

/** One finished focus session, tied to the page the user was on when it started. */
const focusSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Client-made id of the run; saving the same run twice updates one document. */
    runId: { type: String, required: true, maxlength: FOCUS_RUN_ID_MAX },
    /** When the run was first started. */
    startedAt: { type: Date, required: true },
    /** Local date (YYYY-MM-DD) the session started on. */
    date: { type: String, required: true },
    area: { type: String, enum: FOCUS_AREAS, required: true },
    label: { type: String, required: true, maxlength: FOCUS_LABEL_MAX },
    path: { type: String, required: true, maxlength: FOCUS_PATH_MAX },
    seconds: { type: Number, required: true, min: 1, max: FOCUS_MAX_SECONDS },
    /** Planned length in minutes; absent for open-ended sessions. */
    targetMinutes: { type: Number, min: 1, max: FOCUS_MAX_TARGET_MINUTES },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

focusSessionSchema.index({ userId: 1, date: 1 });
focusSessionSchema.index({ userId: 1, runId: 1 }, { unique: true });

export const FocusSession = mongoose.models.FocusSession || model("FocusSession", focusSessionSchema);
