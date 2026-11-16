import mongoose, { Schema, model } from "mongoose";

const ieltsWritingPromptSchema = new Schema(
  {
    task: { type: String, enum: ["task1", "task2"], required: true },
    title: { type: String, required: true },
    brief: { type: String, required: true },
    imageKey: { type: String, default: "" },
    imageAlt: { type: String, default: "" },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    tags: { type: [String], default: [] },
    generated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ieltsWritingPromptSchema.index({ task: 1, status: 1 });

export const IeltsWritingPrompt = mongoose.models.IeltsWritingPrompt || model("IeltsWritingPrompt", ieltsWritingPromptSchema);
