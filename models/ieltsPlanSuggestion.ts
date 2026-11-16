import mongoose, { Schema, model } from "mongoose";

const ieltsPlanSuggestionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["missed", "weak", "hoursShort", "phase", "currentBand"], required: true },
    reason: { type: String, required: true },
    proposal: Schema.Types.Mixed,
    status: { type: String, enum: ["pending", "approved", "dismissed"], default: "pending" },
    decidedAt: Date,
    forDate: { type: String, required: true },
  },
  { timestamps: true },
);

ieltsPlanSuggestionSchema.index({ userId: 1, status: 1 });
ieltsPlanSuggestionSchema.index({ userId: 1, kind: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

export const IeltsPlanSuggestion = mongoose.models.IeltsPlanSuggestion || model("IeltsPlanSuggestion", ieltsPlanSuggestionSchema);
