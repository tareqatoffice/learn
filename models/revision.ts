import mongoose, { Schema, model } from "mongoose";

const revisionSchema = new Schema(
  {
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    editedBy: { type: String }, // user email or "token:<name>"
    editedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

revisionSchema.index({ entityType: 1, entityId: 1, editedAt: -1 });
revisionSchema.index({ editedAt: -1 }); // admin "recent edits" list

export const Revision = mongoose.models.Revision || model("Revision", revisionSchema);
