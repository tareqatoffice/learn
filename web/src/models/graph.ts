import mongoose, { Schema, model } from "mongoose";
import { STATUSES } from "./status";

const trackSchema = new Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const graphSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    footer: { type: String, default: "" },
    subjects: { type: [String], default: [] },
    tracks: { type: [trackSchema], default: [] },
    order: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: "draft" },
    importedAt: Date,
  },
  { timestamps: true },
);

export const Graph = mongoose.models.Graph || model("Graph", graphSchema);
