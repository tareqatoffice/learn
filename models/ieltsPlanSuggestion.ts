import mongoose, { Schema, model } from "mongoose";

const ieltsPlanSuggestionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["missed", "weak", "hoursShort", "phase", "currentBand"], required: true },
    reason: { type: String, required: true },
    /** `{ inputs?, adjustment? }`: applied through the plan generator when approved. */
    proposal: Schema.Types.Mixed,
    status: { type: String, enum: ["pending", "approved", "dismissed"], default: "pending" },
    decidedAt: Date,
    /** Learner-local date the check ran, YYYY-MM-DD. */
    forDate: { type: String, required: true },
  },
  { timestamps: true },
);

ieltsPlanSuggestionSchema.index({ userId: 1, status: 1 });
// At most one pending suggestion of each kind per user, even when two checks race.
ieltsPlanSuggestionSchema.index({ userId: 1, kind: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

export const IeltsPlanSuggestion = mongoose.models.IeltsPlanSuggestion || model("IeltsPlanSuggestion", ieltsPlanSuggestionSchema);
