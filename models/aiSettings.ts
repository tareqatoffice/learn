import mongoose, { Schema, model } from "mongoose";

const aiSettingsSchema = new Schema(
  {
    _id: { type: String, default: "ai" },
    enabled: { type: Boolean, default: true },
    primaryModel: String,
    fallbackModel: { type: String, default: "" },
    visionModel: { type: String, default: "" },
    dailyLimit: Number,
    apiKeyEncrypted: String,
    apiKeyHint: String,
    apiKeyUpdatedAt: Date,
    /** Admin overrides of the editable prompt texts, keyed by prompt key (see features/ai/lib/prompts.ts). */
    prompts: { type: Map, of: String, default: undefined },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const AiSettings = mongoose.models.AiSettings || model("AiSettings", aiSettingsSchema);
