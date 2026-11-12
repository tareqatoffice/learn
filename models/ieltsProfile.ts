import mongoose, { Schema, model } from "mongoose";

const bandsSchema = (overallRequired: boolean) =>
  new Schema(
    {
      overall: { type: Number, required: overallRequired },
      listening: Number,
      reading: Number,
      writing: Number,
      speaking: Number,
    },
    { _id: false },
  );

const ieltsProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    /** YYYY-MM-DD. */
    testDate: { type: String, required: true },
    target: { type: bandsSchema(true), required: true },
    current: { type: bandsSchema(false), default: () => ({}) },
    minutesPerDay: { type: Number, required: true },
    studyDays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    examinerVoice: { type: Boolean, default: true },
    mockVideo: { type: Boolean, default: true },
    drillVideo: { type: Boolean, default: false },
    /** Learner-local date of the last suggestion check, YYYY-MM-DD. */
    lastCheckDate: String,
  },
  { timestamps: true },
);

export const IeltsProfile = mongoose.models.IeltsProfile || model("IeltsProfile", ieltsProfileSchema);
