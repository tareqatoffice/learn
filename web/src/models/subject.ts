import mongoose, { Schema, model } from "mongoose";

const subjectSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    importedAt: Date,
  },
  { timestamps: true },
);

export const Subject = mongoose.models.Subject || model("Subject", subjectSchema);
