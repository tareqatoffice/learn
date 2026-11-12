import mongoose, { Schema, model } from "mongoose";

const criteria = { ta: Number, cc: Number, lr: Number, gra: Number };

const taskSchema = new Schema(
  {
    task: { type: String, enum: ["task1", "task2"], required: true },
    promptId: Schema.Types.ObjectId,
    title: { type: String, required: true },
    brief: { type: String, required: true },
    imageKey: { type: String, default: "" },
    imageAlt: { type: String, default: "" },
    text: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    timeSec: { type: Number, default: 0 },
    self: { ...criteria, notes: String },
    ai: {
      bands: criteria,
      reasons: { ta: String, cc: String, lr: String, gra: String },
      evidence: { ta: [String], cc: [String], lr: [String], gra: [String] },
      overall: Number,
      strengths: [String],
      improvements: [{ _id: false, advice: String, original: String, rewrite: String }],
      model: String,
      at: Date,
    },
  },
  { _id: false },
);

/** A Writing drill (one task) or full test (both), with the learner's text and ratings. */
const ieltsWritingAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    kind: { type: String, enum: ["task1", "task2", "full"], required: true },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    tasks: { type: [taskSchema], default: [] },
    startedAt: { type: Date, required: true },
    submittedAt: Date,
  },
  { timestamps: true },
);

ieltsWritingAttemptSchema.index({ userId: 1, date: 1 });

export const IeltsWritingAttempt = mongoose.models.IeltsWritingAttempt || model("IeltsWritingAttempt", ieltsWritingAttemptSchema);
