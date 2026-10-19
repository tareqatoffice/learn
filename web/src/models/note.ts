import { Schema, model, models } from "mongoose";
import { STATUSES } from "./status";

const tocEntrySchema = new Schema(
  {
    depth: { type: Number, required: true },
    text: { type: String, required: true },
    anchor: { type: String, required: true },
  },
  { _id: false },
);

const noteSchema = new Schema(
  {
    seriesId: { type: Schema.Types.ObjectId, ref: "NoteSeries", required: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
    body: { type: String, default: "" },
    toc: { type: [tocEntrySchema], default: [] },
    readMinutes: { type: Number, default: 1 },
    subjects: { type: [String], default: [] },
    status: { type: String, enum: STATUSES, default: "draft" },
    importedAt: Date,
  },
  { timestamps: true },
);

noteSchema.index({ seriesId: 1, slug: 1 }, { unique: true });
noteSchema.index({ seriesId: 1, order: 1 });

export const Note = models.Note || model("Note", noteSchema);
