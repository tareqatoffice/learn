import mongoose, { Schema, model } from "mongoose";

/**
 * The AI coach settings an admin chooses (one document, `_id: "ai"`). Unset fields fall back to the
 * environment. An OpenRouter key saved here is encrypted (lib/secrets.ts) and overrides
 * OPENROUTER_API_KEY; only its last characters are kept in the clear, as a hint.
 */
const aiSettingsSchema = new Schema(
  {
    _id: { type: String, default: "ai" },
    enabled: { type: Boolean, default: true },
    primaryModel: String,
    fallbackModel: { type: String, default: "" },
    /** Reads still frames for speaking body-language feedback; empty = use the primary chain. */
    visionModel: { type: String, default: "" },
    dailyLimit: Number,
    apiKeyEncrypted: String,
    apiKeyHint: String,
    apiKeyUpdatedAt: Date,
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const AiSettings = mongoose.models.AiSettings || model("AiSettings", aiSettingsSchema);
