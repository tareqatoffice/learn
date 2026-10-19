import { Schema, model, models } from "mongoose";

const questionProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "QuestionBook", required: true },
    status: { type: String, enum: ["got", "review", null], default: null },
    seenCount: { type: Number, default: 0 },
    lastSeenAt: Date,
  },
  { timestamps: true },
);

questionProgressSchema.index({ userId: 1, questionId: 1 }, { unique: true });
questionProgressSchema.index({ userId: 1, bookId: 1, status: 1 });

export const QuestionProgress =
  models.QuestionProgress || model("QuestionProgress", questionProgressSchema);
