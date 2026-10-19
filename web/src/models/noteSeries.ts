import { Schema, model, models } from "mongoose";
import { STATUSES } from "./status";

const noteSeriesSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    subjects: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: "draft" },
    importedAt: Date,
  },
  { timestamps: true },
);

export const NoteSeries = models.NoteSeries || model("NoteSeries", noteSeriesSchema);
