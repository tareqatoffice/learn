import mongoose, { Schema, model } from "mongoose";
import { DEFAULT_TARGET_MIN } from "@/speaking/tasks";

/** Singleton: the default daily targets in minutes. */
const speakingSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    targets: {
      shadowing: { type: Number, default: DEFAULT_TARGET_MIN.shadowing },
      readAloud: { type: Number, default: DEFAULT_TARGET_MIN.readAloud },
      recordReview: { type: Number, default: DEFAULT_TARGET_MIN.recordReview },
    },
  },
  { timestamps: true },
);

export const SpeakingSettings = mongoose.models.SpeakingSettings || model("SpeakingSettings", speakingSettingsSchema);
