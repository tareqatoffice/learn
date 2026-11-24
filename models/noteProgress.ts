import mongoose, { Schema, model } from "mongoose";
import { PREQ_MAX_LEN } from "@/models/studyConstants";

const noteProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true },
    seriesId: { type: Schema.Types.ObjectId, ref: "NoteSeries", required: true },
    read: { type: Boolean, default: false },
    readAt: Date,
    lastOpenedAt: Date,
    lastAnchor: { type: String, maxlength: 200 },
    preQuestions: { type: [{ type: String, maxlength: PREQ_MAX_LEN }], default: undefined },
  },
  { timestamps: true },
);

noteProgressSchema.index({ userId: 1, noteId: 1 }, { unique: true });
noteProgressSchema.index({ userId: 1, lastOpenedAt: -1 });

export const NoteProgress = mongoose.models.NoteProgress || model("NoteProgress", noteProgressSchema);
