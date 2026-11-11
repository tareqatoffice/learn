import mongoose, { Schema, model } from "mongoose";
import { TASKS } from "@/speaking/tasks";

const materialSchema = new Schema(
  { title: String, text: String, prompt: String, generated: { type: Boolean, default: false } },
  { _id: false },
);

const mediaSchema = new Schema(
  {
    kind: { type: String, enum: ["audio", "video"], required: true },
    key: { type: String, required: true },
    mime: { type: String, required: true },
    audioKey: String,
    audioMime: String,
    durationSec: { type: Number, required: true },
    capSec: { type: Number, required: true },
    size: Number,
    stored: { type: Boolean, default: false },
  },
  { _id: false },
);

const selfSchema = new Schema(
  { fluency: Number, confidence: Number, eyeContact: Number, gestures: Number, note: String },
  { _id: false },
);

const markerSchema = new Schema(
  { atSec: { type: Number, required: true }, label: { type: String, required: true } },
  { _id: false },
);

const speechSchema = new Schema(
  {
    fluency: Number,
    vocabulary: Number,
    grammar: Number,
    summary: String,
    strengths: { type: [String], default: undefined },
    workOn: { type: [String], default: undefined },
    missedWords: { type: [String], default: undefined },
  },
  { _id: false },
);

const bodySchema = new Schema(
  {
    confidence: Number,
    eyeContact: Number,
    gestures: Number,
    suggestions: { type: [String], default: undefined },
  },
  { _id: false },
);

const aiSchema = new Schema(
  {
    speech: { type: speechSchema, default: undefined },
    body: { type: bodySchema, default: undefined },
    model: String,
    at: Date,
  },
  { _id: false },
);

const speakingTakeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Learner-local calendar date, YYYY-MM-DD. */
    date: { type: String, required: true },
    task: { type: String, enum: TASKS, required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "SpeakingLesson" },
    material: { type: materialSchema, default: () => ({}) },
    media: { type: mediaSchema, required: true },
    transcript: String,
    transcriptStatus: { type: String, enum: ["none", "pending", "done", "failed", "unavailable"], default: "none" },
    self: { type: selfSchema, default: undefined },
    markers: { type: [markerSchema], default: [] },
    ai: { type: aiSchema, default: undefined },
  },
  { timestamps: true },
);

speakingTakeSchema.index({ userId: 1, date: -1 });
speakingTakeSchema.index({ userId: 1, task: 1, date: -1 });

export const SpeakingTake = mongoose.models.SpeakingTake || model("SpeakingTake", speakingTakeSchema);
