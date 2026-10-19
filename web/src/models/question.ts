import { Schema, model, models } from "mongoose";
import { STATUSES } from "./status";

const questionSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "QuestionBook", required: true },
    partKey: { type: String, required: true },
    order: { type: Number, default: 0 },
    question: { type: String, required: true },
    prompt: { type: String, default: "" },
    answer: { type: String, required: true },
    subjects: { type: [String], default: [] },
    status: { type: String, enum: STATUSES, default: "draft" },
    importKey: String,
    importedAt: Date,
  },
  { timestamps: true },
);

questionSchema.index({ bookId: 1, partKey: 1, order: 1 });
questionSchema.index({ importKey: 1 }, { unique: true, sparse: true });
questionSchema.index({ subjects: 1 });

export const Question = models.Question || model("Question", questionSchema);
