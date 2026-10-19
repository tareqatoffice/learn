import mongoose, { Schema, model } from "mongoose";

const noteProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true },
    seriesId: { type: Schema.Types.ObjectId, ref: "NoteSeries", required: true },
    read: { type: Boolean, default: false },
    readAt: Date,
    lastOpenedAt: Date,
  },
  { timestamps: true },
);

noteProgressSchema.index({ userId: 1, noteId: 1 }, { unique: true });
noteProgressSchema.index({ userId: 1, lastOpenedAt: -1 });

export const NoteProgress = mongoose.models.NoteProgress || model("NoteProgress", noteProgressSchema);
