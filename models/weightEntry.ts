import mongoose, { Schema, model } from "mongoose";

const weightEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    profileId: { type: Schema.Types.ObjectId, ref: "ExerciseProfile", required: true },
    date: { type: String, required: true },
    kg: { type: Number, required: true },
  },
  { timestamps: true },
);

weightEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

export const WeightEntry = mongoose.models.WeightEntry || model("WeightEntry", weightEntrySchema);
