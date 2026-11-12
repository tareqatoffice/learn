import mongoose, { Schema, model } from "mongoose";
import { sectionSchema } from "./ieltsQuestionSchema";

/** One Listening or Reading attempt. The questions are copied so later admin edits don't change history. */
const ieltsTestAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: String, enum: ["listening", "reading"], required: true },
    testId: { type: Schema.Types.ObjectId },
    title: { type: String, required: true },
    date: { type: String, required: true },
    /** "full" or the 0-based section index as a string. */
    scope: { type: String, required: true },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    sections: { type: [sectionSchema], default: [] },
    /** Question number to the learner's answer. */
    answers: { type: Map, of: String, default: {} },
    /** Sections whose script was already read aloud by the browser voice (one play in a full test). */
    played: { type: [Number], default: [] },
    startedAt: { type: Date, required: true },
    submittedAt: Date,
    limitSec: { type: Number, required: true },
    timeSec: { type: Number, default: 0 },
    score: {
      raw: Number,
      total: Number,
      band: Number,
      results: [{ _id: false, n: Number, given: String, correct: Boolean }],
    },
  },
  { timestamps: true },
);

ieltsTestAttemptSchema.index({ userId: 1, date: 1 });
ieltsTestAttemptSchema.index({ userId: 1, skill: 1, createdAt: -1 });

export const IeltsTestAttempt = mongoose.models.IeltsTestAttempt || model("IeltsTestAttempt", ieltsTestAttemptSchema);
