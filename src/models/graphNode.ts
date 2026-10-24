import mongoose, { Schema, model } from "mongoose";
import { STATUSES } from "./status";

const relatedNoteSchema = new Schema(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true },
    anchor: { type: String, default: "" },
  },
  { _id: false },
);

const relatedSchema = new Schema(
  {
    questionIds: { type: [Schema.Types.ObjectId], default: [] },
    notes: { type: [relatedNoteSchema], default: [] },
  },
  { _id: false },
);

const graphNodeSchema = new Schema(
  {
    graphId: { type: Schema.Types.ObjectId, ref: "Graph", required: true },
    slug: { type: String, required: true },
    trackKey: { type: String, required: true },
    title: { type: String, required: true },
    prereqIds: { type: [Schema.Types.ObjectId], default: [] },
    summary: { type: String, default: "" },
    points: { type: [String], default: [] },
    code: { type: String, default: "" },
    pitfall: { type: String, default: "" },
    docsUrl: { type: String, default: "" },
    order: { type: Number, default: 0 },
    related: { type: relatedSchema, default: () => ({}) },
    subjects: { type: [String], default: [] },
    status: { type: String, enum: STATUSES, default: "draft" },
    importedAt: Date,
  },
  { timestamps: true },
);

graphNodeSchema.index({ graphId: 1, slug: 1 }, { unique: true });
graphNodeSchema.index({ graphId: 1, order: 1 });
graphNodeSchema.index({ "related.questionIds": 1 });
graphNodeSchema.index({ "related.notes.noteId": 1 });

export const GraphNode = mongoose.models.GraphNode || model("GraphNode", graphNodeSchema);
