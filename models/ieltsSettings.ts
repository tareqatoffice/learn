import mongoose, { Schema, model } from "mongoose";

/** Singleton: plan arithmetic and suggestion thresholds. */
const ieltsSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    hoursPerBand: { type: Number, default: 200 },
    split: {
      foundation: { type: Number, default: 30 },
      skills: { type: Number, default: 45 },
      mocks: { type: Number, default: 25 },
    },
    thresholds: {
      missedShare: { type: Number, default: 0.6 },
      missedStreak: { type: Number, default: 3 },
      weakGap: { type: Number, default: 1 },
      shiftShare: { type: Number, default: 0.15 },
      currentBandGap: { type: Number, default: 0.5 },
      dismissDays: { type: Number, default: 7 },
    },
  },
  { timestamps: true },
);

export const IeltsSettings = mongoose.models.IeltsSettings || model("IeltsSettings", ieltsSettingsSchema);
