import mongoose, { Schema, model } from "mongoose";

/** The lesson assigned to a learner for a local date, so it stays stable through the day. */
const speakingDaySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "SpeakingLesson", required: true },
  },
  { timestamps: true },
);

speakingDaySchema.index({ userId: 1, date: 1 }, { unique: true });

export const SpeakingDay = mongoose.models.SpeakingDay || model("SpeakingDay", speakingDaySchema);
