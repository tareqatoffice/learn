import { Schema, model, models } from "mongoose";
import { STATUSES } from "./status";

const partSchema = new Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    intro: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const extraSchema = new Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const questionBookSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    intro: { type: String, default: "" },
    subjects: { type: [String], default: [] },
    parts: { type: [partSchema], default: [] },
    extras: { type: [extraSchema], default: [] },
    order: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: "draft" },
    importedAt: Date,
  },
  { timestamps: true },
);

export const QuestionBook = models.QuestionBook || model("QuestionBook", questionBookSchema);
