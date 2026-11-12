import mongoose, { Schema, model } from "mongoose";
import { SKILLS } from "@/ielts/bands";

const adjustmentSchema = new Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ["shiftCriterion", "spreadShortfall"], required: true },
    criterion: String,
    share: Number,
    minutes: Number,
    fromWeek: Number,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const phaseSchema = new Schema(
  { name: { type: String, required: true }, start: { type: String, required: true }, end: { type: String, required: true } },
  { _id: false },
);

const minutesSchema = new Schema(Object.fromEntries(SKILLS.map((s) => [s, { type: Number, default: 0 }])), { _id: false });

const weekSchema = new Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
    minutes: { type: minutesSchema, required: true },
    mocks: { type: Number, default: 0 },
    focus: String,
  },
  { _id: false },
);

const ieltsPlanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: Number, required: true },
    startDate: { type: String, required: true },
    testDate: { type: String, required: true },
    inputs: Schema.Types.Mixed,
    adjustments: { type: [adjustmentSchema], default: [] },
    phases: { type: [phaseSchema], default: [] },
    weeks: { type: [weekSchema], default: [] },
    hours: {
      needed: { type: Number, required: true },
      available: { type: Number, required: true },
      short: { type: Boolean, default: false },
    },
    reason: { type: String, required: true },
  },
  { timestamps: true },
);

ieltsPlanSchema.index({ userId: 1, version: 1 }, { unique: true });

export const IeltsPlan = mongoose.models.IeltsPlan || model("IeltsPlan", ieltsPlanSchema);
