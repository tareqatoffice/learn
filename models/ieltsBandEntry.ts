import mongoose, { Schema, model } from "mongoose";

export const IELTS_BAND_SOURCES = ["official", "practice", "practiceTest", "mockSelf", "mockAi", "writingSelf", "writingAi", "other"] as const;

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
    attemptId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

ieltsBandEntrySchema.index({ userId: 1, date: 1 });
ieltsBandEntrySchema.index({ userId: 1, attemptId: 1, source: 1 }, { unique: true, partialFilterExpression: { attemptId: { $exists: true } } });

export const IeltsBandEntry = mongoose.models.IeltsBandEntry || model("IeltsBandEntry", ieltsBandEntrySchema);
