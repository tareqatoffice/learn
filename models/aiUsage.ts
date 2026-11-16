import mongoose, { Schema, model } from "mongoose";

const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

aiUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

export const AiUsage = mongoose.models.AiUsage || model("AiUsage", aiUsageSchema);
