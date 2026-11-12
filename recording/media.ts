import { Schema } from "mongoose";

/**
 * A recording's stored media. The shape (and so every stored `media.*` path) is the one Speaking
 * Practice takes have always used; IELTS attempts embed the same sub-schema.
 */
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

/** AI body-language feedback on a video recording (stored under `ai.body`). */
export const bodySchema = new Schema(
  {
    confidence: Number,
    eyeContact: Number,
    gestures: Number,
    suggestions: { type: [String], default: undefined },
  },
  { _id: false },
);

export { MEDIA_EXT, type MediaDoc, baseMime, capBytes, keysOf } from "./mediaCore";
