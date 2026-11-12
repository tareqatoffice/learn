import { Schema } from "mongoose";

const questionSchema = new Schema(
  {
    n: { type: Number, required: true },
    kind: { type: String, enum: ["mcq", "tfng", "ynng", "completion", "matching"], required: true },
    prompt: { type: String, required: true },
    options: { type: [String], default: [] },
    answers: { type: [String], default: [] },
    explanation: { type: String, default: "" },
  },
  { _id: false },
);

const groupSchema = new Schema(
  {
    kind: { type: String, required: true },
    instruction: { type: String, default: "" },
    options: { type: [String], default: [] },
    questions: { type: [questionSchema], default: [] },
  },
  { _id: false },
);

/** A Reading passage or a Listening part, with its question groups. */
export const sectionSchema = new Schema(
  {
    title: { type: String, required: true },
    passage: { type: String, default: "" },
    script: { type: String, default: "" },
    audioKey: { type: String, default: "" },
    durationSec: { type: Number, default: 0 },
    groups: { type: [groupSchema], default: [] },
  },
  { _id: false },
);
