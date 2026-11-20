import mongoose, { Schema, model } from "mongoose";

const checkSchema = new Schema(
  {
    name: { type: String, required: true },
    passed: { type: Boolean, required: true },
    detail: { type: String, default: "" },
  },
  { _id: false },
);

const codingResultSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    group: { type: String, required: true },
    question: { type: String, required: true },
    checks: { type: [checkSchema], default: [] },
    passed: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true },
);

codingResultSchema.index({ userId: 1, group: 1, question: 1 }, { unique: true });

export const CodingResult = mongoose.models.CodingResult || model("CodingResult", codingResultSchema);
