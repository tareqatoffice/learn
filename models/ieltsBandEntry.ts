import mongoose, { Schema, model } from "mongoose";

const ieltsBandEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    source: { type: String, enum: ["official", "practice", "mockSelf", "mockAi", "other"], required: true },
    bands: {
      listening: Number,
      reading: Number,
      writing: Number,
      speaking: Number,
    },
    overall: Number,
    attemptId: { type: Schema.Types.ObjectId, ref: "IeltsSpeakingAttempt" },
  },
  { timestamps: true },
);

ieltsBandEntrySchema.index({ userId: 1, date: 1 });

export const IeltsBandEntry = mongoose.models.IeltsBandEntry || model("IeltsBandEntry", ieltsBandEntrySchema);
