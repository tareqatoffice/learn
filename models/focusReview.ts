import mongoose, { Schema, model } from "mongoose";
import { FOCUS_DATE_RE, FOCUS_REVIEW_TEXT_MAX } from "@/models/focusConstants";

const text = { type: String, default: "", maxlength: FOCUS_REVIEW_TEXT_MAX };

const focusReviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    weekStart: { type: String, required: true, match: FOCUS_DATE_RE },
    helped: text,
    pulledAway: text,
    change: text,
  },
  { timestamps: true },
);

focusReviewSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

export const FocusReview = mongoose.models.FocusReview || model("FocusReview", focusReviewSchema);
