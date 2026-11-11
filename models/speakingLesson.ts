import mongoose, { Schema, model } from "mongoose";
import { STATUSES } from "./status";

const shadowSchema = new Schema(
  { audioKey: String, audioUrl: String, durationSec: Number, text: String },
  { _id: false },
);

const speakingLessonSchema = new Schema(
  {
    title: { type: String, required: true },
    order: { type: Number, required: true },
    status: { type: String, enum: STATUSES, default: "draft" },
    subjectIds: { type: [Schema.Types.ObjectId], default: [] },
    shadow: { type: shadowSchema, default: () => ({}) },
    passage: String,
    prompt: String,
  },
  { timestamps: true },
);

export const SpeakingLesson = mongoose.models.SpeakingLesson || model("SpeakingLesson", speakingLessonSchema);
