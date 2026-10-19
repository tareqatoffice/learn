import { Schema, model, models } from "mongoose";

const filterSchema = new Schema(
  {
    bookIds: { type: [Schema.Types.ObjectId], default: [] },
    partKeys: { type: [String], default: [] },
    mode: { type: String, enum: ["unseen", "review", "all"], required: true },
    questionIds: { type: [Schema.Types.ObjectId], default: undefined },
  },
  { _id: false },
);

const resultSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    result: { type: String, enum: ["got", "review", "skip"], required: true },
    at: { type: Date, default: Date.now },
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

export const QuizSession = models.QuizSession || model("QuizSession", quizSessionSchema);
