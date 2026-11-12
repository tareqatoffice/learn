import mongoose, { type Types, Schema, model } from "mongoose";
import { CRITERIA } from "@/ielts/bands";
import { bodySchema, mediaSchema } from "@/recording/media";

const numbers = () => Object.fromEntries(CRITERIA.map((c) => [c, Number]));
const strings = () => Object.fromEntries(CRITERIA.map((c) => [c, String]));
const lists = () => Object.fromEntries(CRITERIA.map((c) => [c, { type: [String], default: undefined }]));

const frameSchema = new Schema({ title: String, questions: { type: [String], default: [] } }, { _id: false });
const cueSchema = new Schema(
  { topic: String, bullets: { type: [String], default: [] }, explain: String, roundOff: { type: [String], default: [] } },
  { _id: false },
);

const questionsSchema = new Schema(
  {
    part1: {
      type: new Schema({ itemIds: [Schema.Types.ObjectId], frames: { type: [frameSchema], default: [] } }, { _id: false }),
      default: undefined,
    },
    part2: {
      type: new Schema({ itemId: Schema.Types.ObjectId, cue: cueSchema }, { _id: false }),
      default: undefined,
    },
    part3: {
      type: new Schema({ itemId: Schema.Types.ObjectId, questions: { type: [String], default: [] } }, { _id: false }),
      default: undefined,
    },
  },
  { _id: false },
);

/** The questions an attempt was given (bank item ids, or the text itself for AI-written sets). */
export type IeltsSpeakingQuestions = {
  part1?: { itemIds: Types.ObjectId[]; frames: { title: string; questions: string[] }[] };
  part2?: { itemId?: Types.ObjectId; cue: { topic: string; bullets: string[]; explain: string; roundOff: string[] } };
  part3?: { itemId?: Types.ObjectId; questions: string[] };
};

const markerSchema = new Schema(
  { atSec: { type: Number, required: true }, label: { type: String, required: true } },
  { _id: false },
);

const partSchema = new Schema(
  {
    part: { type: String, enum: ["p1", "p2", "p3"], required: true },
    media: { type: mediaSchema, required: true },
    /** Set on each startPart, so concurrent starts and confirms of the same part can tell uploads apart. */
    uploadId: String,
    transcript: String,
    transcriptStatus: { type: String, enum: ["none", "pending", "running", "done", "failed", "unavailable"], default: "none" },
    /** When the running transcription was claimed; a claim older than a few minutes can be taken over. */
    transcribeStartedAt: Date,
    markers: { type: [markerSchema], default: [] },
  },
  { _id: false },
);

const selfSchema = new Schema(
  { ...numbers(), notes: Schema.Types.Mixed, confidence: Number, eyeContact: Number, gestures: Number },
  { _id: false },
);

const aiSchema = new Schema(
  {
    bands: new Schema(numbers(), { _id: false }),
    reasons: new Schema(strings(), { _id: false }),
    evidence: new Schema(lists(), { _id: false }),
    overall: Number,
    strengths: { type: [String], default: undefined },
    nextBand: {
      type: [new Schema({ advice: String, original: String, rewrite: String }, { _id: false })],
      default: undefined,
    },
    model: String,
    at: Date,
  },
  { _id: false },
);

const ieltsSpeakingAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Learner-local calendar date, YYYY-MM-DD. */
    date: { type: String, required: true },
    kind: { type: String, enum: ["mock", "part1", "part2", "part3"], required: true },
    status: { type: String, enum: ["inProgress", "complete", "incomplete"], default: "inProgress" },
    questions: { type: questionsSchema, default: () => ({}) },
    generated: { type: Boolean, default: false },
    notes: String,
    parts: { type: [partSchema], default: [] },
    self: { type: selfSchema, default: undefined },
    ai: { type: aiSchema, default: undefined },
    body: { type: bodySchema, default: undefined },
    paused: { type: Boolean, default: false },
    videoUsed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ieltsSpeakingAttemptSchema.index({ userId: 1, date: -1 });

export const IeltsSpeakingAttempt = mongoose.models.IeltsSpeakingAttempt || model("IeltsSpeakingAttempt", ieltsSpeakingAttemptSchema);
