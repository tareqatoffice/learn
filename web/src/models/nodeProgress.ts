import { Schema, model, models } from "mongoose";

const nodeProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    graphId: { type: Schema.Types.ObjectId, ref: "Graph", required: true },
    nodeId: { type: Schema.Types.ObjectId, ref: "GraphNode", required: true },
    status: { type: String, enum: ["learning", "done"], required: true },
    startedAt: Date,
    doneAt: Date,
  },
  { timestamps: true },
);

nodeProgressSchema.index({ userId: 1, nodeId: 1 }, { unique: true });
nodeProgressSchema.index({ userId: 1, graphId: 1 });
nodeProgressSchema.index({ userId: 1, status: 1 });

export const NodeProgress = models.NodeProgress || model("NodeProgress", nodeProgressSchema);
