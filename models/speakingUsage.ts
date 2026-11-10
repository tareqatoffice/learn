import mongoose, { Schema, model } from "mongoose";

/** Speech-to-text calls per user per day, for the daily limit. Rows expire after a few days. */
const speakingUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

speakingUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
speakingUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

export const SpeakingUsage = mongoose.models.SpeakingUsage || model("SpeakingUsage", speakingUsageSchema);
