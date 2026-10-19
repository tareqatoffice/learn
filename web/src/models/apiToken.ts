import mongoose, { Schema, model } from "mongoose";

const apiTokenSchema = new Schema(
  {
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastUsedAt: Date,
    revokedAt: Date,
  },
  { timestamps: true },
);

export const ApiToken = mongoose.models.ApiToken || model("ApiToken", apiTokenSchema);
