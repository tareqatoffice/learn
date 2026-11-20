import { Schema } from "mongoose";

export const mediaSchema = new Schema(
  {
    kind: { type: String, enum: ["audio", "video"], required: true },
    key: { type: String, required: true },
    mime: { type: String, required: true },
    audioKey: String,
    audioMime: String,
    durationSec: { type: Number, required: true },
    capSec: { type: Number, required: true },
    size: Number,
    stored: { type: Boolean, default: false },
  },
  { _id: false },
);

export const bodySchema = new Schema(
  {
    confidence: Number,
    eyeContact: Number,
    gestures: Number,
    suggestions: { type: [String], default: undefined },
  },
  { _id: false },
);
