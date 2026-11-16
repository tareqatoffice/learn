import mongoose, { Schema, model } from "mongoose";

export const ACCESS_STATUSES = ["pending", "approved", "blocked"] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    image: String,
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastLoginAt: Date,
    status: { type: String, enum: ACCESS_STATUSES },
    requestNote: String,
    blockReason: String,
    reviewedAt: Date,
    reviewedBy: String,
  },
  { timestamps: true },
);

export const User = mongoose.models.User || model("User", userSchema);
