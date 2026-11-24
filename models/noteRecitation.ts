import mongoose, { Schema, model } from "mongoose";
import { ANCHOR_MAX, RECITE_MAX, RECITE_VERDICTS } from "@/models/studyConstants";

const noteRecitationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true },
    anchor: { type: String, required: true, maxlength: ANCHOR_MAX },
    text: { type: String, required: true, maxlength: RECITE_MAX },
    verdict: { type: String, enum: RECITE_VERDICTS, required: true },
  },
  { timestamps: true },
);

noteRecitationSchema.index({ userId: 1, noteId: 1, anchor: 1 }, { unique: true });
noteRecitationSchema.index({ userId: 1, verdict: 1, updatedAt: -1 });

export const NoteRecitation = mongoose.models.NoteRecitation || model("NoteRecitation", noteRecitationSchema);
