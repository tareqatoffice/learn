import mongoose, { Schema, model } from "mongoose";
import {
  FOCUS_PLAN_ACTION_MAX,
  FOCUS_PLAN_MAX_MINUTES,
  FOCUS_PLAN_MIN_MINUTES,
  FOCUS_TIME_RE,
} from "@/models/focusConstants";

const focusPlanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    time: { type: String, required: true, match: FOCUS_TIME_RE },
    action: { type: String, required: true, maxlength: FOCUS_PLAN_ACTION_MAX },
    minutes: { type: Number, required: true, min: FOCUS_PLAN_MIN_MINUTES, max: FOCUS_PLAN_MAX_MINUTES },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const FocusPlan = mongoose.models.FocusPlan || model("FocusPlan", focusPlanSchema);
