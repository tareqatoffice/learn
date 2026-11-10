import mongoose, { Schema, model } from "mongoose";
import { VIDEO_DEFAULT } from "@/speaking/tasks";

/** One learner's speaking preferences. Absent target values fall back to the admin defaults. */
const speakingProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    targets: {
      shadowing: Number,
      readAloud: Number,
      recordReview: Number,
    },
    enabled: {
      shadowing: { type: Boolean, default: true },
      readAloud: { type: Boolean, default: true },
      recordReview: { type: Boolean, default: true },
    },
    video: {
      shadowing: { type: Boolean, default: VIDEO_DEFAULT.shadowing },
      readAloud: { type: Boolean, default: VIDEO_DEFAULT.readAloud },
      recordReview: { type: Boolean, default: VIDEO_DEFAULT.recordReview },
    },
    bodyConsentAt: Date,
  },
  { timestamps: true },
);

export const SpeakingProfile = mongoose.models.SpeakingProfile || model("SpeakingProfile", speakingProfileSchema);
