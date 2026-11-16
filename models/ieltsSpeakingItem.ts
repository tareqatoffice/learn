import mongoose, { Schema, model } from "mongoose";

const cueSchema = new Schema(
  {
    topic: { type: String, required: true },
    bullets: { type: [String], default: [] },
    explain: { type: String, default: "" },
    roundOff: { type: [String], default: [] },
  },
  { _id: false },
);

const ieltsSpeakingItemSchema = new Schema(
  {
    type: { type: String, enum: ["part1", "part2", "part3"], required: true },
    title: { type: String, required: true },
    aboutYou: { type: Boolean, default: false },
    questions: { type: [String], default: [] },
    cue: { type: cueSchema, default: undefined },
    cardId: { type: Schema.Types.ObjectId, ref: "IeltsSpeakingItem" },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    tags: { type: [String], default: [] },
    generated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ieltsSpeakingItemSchema.index({ type: 1, status: 1 });

export const IeltsSpeakingItem = mongoose.models.IeltsSpeakingItem || model("IeltsSpeakingItem", ieltsSpeakingItemSchema);
