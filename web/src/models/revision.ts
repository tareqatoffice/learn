import { Schema, model, models } from "mongoose";

const revisionSchema = new Schema(
  {
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    editedBy: { type: Schema.Types.ObjectId, ref: "User" },
    editedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

revisionSchema.index({ entityType: 1, entityId: 1, editedAt: -1 });

export const Revision = models.Revision || model("Revision", revisionSchema);
