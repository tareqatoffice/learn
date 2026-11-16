import mongoose, { Schema, model } from "mongoose";

/** Where a band entry came from: typed in (official, practice, other) or synced from an attempt. */
export const IELTS_BAND_SOURCES = ["official", "practice", "mockSelf", "mockAi", "writingSelf", "writingAi", "other"] as const;

const ieltsBandEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    source: { type: String, enum: IELTS_BAND_SOURCES, required: true },
    bands: {
      listening: Number,
      reading: Number,
      writing: Number,
      speaking: Number,
    },
    overall: Number,
    /** The Speaking, Writing, Listening or Reading attempt this entry came from (the source says which). */
    attemptId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

ieltsBandEntrySchema.index({ userId: 1, date: 1 });

export const IeltsBandEntry = mongoose.models.IeltsBandEntry || model("IeltsBandEntry", ieltsBandEntrySchema);
