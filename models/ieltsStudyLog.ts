import mongoose, { Schema, model } from "mongoose";
import { SKILLS } from "@/ielts/bands";

const ieltsStudyLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Learner-local calendar date, YYYY-MM-DD. */
    date: { type: String, required: true },
    skill: { type: String, enum: SKILLS, required: true },
    minutes: { type: Number, required: true, min: 1, max: 480 },
  },
  { timestamps: true },
);

ieltsStudyLogSchema.index({ userId: 1, date: 1 });

export const IeltsStudyLog = mongoose.models.IeltsStudyLog || model("IeltsStudyLog", ieltsStudyLogSchema);
