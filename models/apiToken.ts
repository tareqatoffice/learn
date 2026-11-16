import mongoose, { Schema, model } from "mongoose";

export const TOKEN_SCOPES = ["read", "write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

const apiTokenSchema = new Schema(
  {
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastUsedAt: Date,
    revokedAt: Date,
    /** "read" lists and pulls; "write" may also import. Tokens made before scopes existed can write. */
    scope: { type: String, enum: TOKEN_SCOPES, default: "write" },
    /** After this the token stops working; unset means it never expires. */
    expiresAt: Date,
  },
  { timestamps: true },
);

export const ApiToken = mongoose.models.ApiToken || model("ApiToken", apiTokenSchema);
