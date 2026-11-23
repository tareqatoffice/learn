import mongoose, { Schema, model } from "mongoose";

const speakingTakeUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

speakingTakeUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
speakingTakeUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

export const SpeakingTakeUsage =
  mongoose.models.SpeakingTakeUsage || model("SpeakingTakeUsage", speakingTakeUsageSchema);
