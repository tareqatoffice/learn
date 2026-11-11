import mongoose, { Schema, model } from "mongoose";
import { ANSWER_MODES } from "@/lib/quiz-answer";

const filterSchema = new Schema(
  {
    bookIds: { type: [Schema.Types.ObjectId], default: [] },
    partKeys: { type: [String], default: [] },
    mode: { type: String, enum: ["unseen", "review", "all"], required: true },
    questionIds: { type: [Schema.Types.ObjectId], default: undefined },
  },
  { _id: false },
);

const chatSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { _id: false },
);

/** The AI coach's grade of the attempt and the follow-up chat, copied in when the card is marked (conversations expire). */
const coachSchema = new Schema(
  {
    verdict: { type: String, enum: ["correct", "partial", "incorrect"] },
    score: Number,
    summary: String,
    strengths: { type: [String], default: undefined },
    missing: { type: [String], default: undefined },
    model: String,
    chat: { type: [chatSchema], default: undefined },
  },
  { _id: false },
);

const resultSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    result: { type: String, enum: ["got", "review", "skip"], required: true },
    at: { type: Date, default: Date.now },
    /** What the learner wrote or dictated before marking; absent when they only revealed the answer. */
    answer: String,
    answerMode: { type: String, enum: ANSWER_MODES },
    coach: { type: coachSchema, default: undefined },
  },
  { _id: false },
);

const quizSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    filter: { type: filterSchema, required: true },
    questionIds: { type: [Schema.Types.ObjectId], default: [] },
    cursor: { type: Number, default: 0 },
    results: { type: [resultSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
  },
  { timestamps: true },
);

quizSessionSchema.index({ userId: 1, startedAt: -1 });

export const QuizSession = mongoose.models.QuizSession || model("QuizSession", quizSessionSchema);
