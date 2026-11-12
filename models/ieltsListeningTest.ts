import mongoose, { Schema, model } from "mongoose";
import { sectionSchema } from "./ieltsQuestionSchema";

const ieltsListeningTestSchema = new Schema(
  {
    title: { type: String, required: true },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    sections: { type: [sectionSchema], default: [] },
    generated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ieltsListeningTestSchema.index({ status: 1 });

export const IeltsListeningTest = mongoose.models.IeltsListeningTest || model("IeltsListeningTest", ieltsListeningTestSchema);
