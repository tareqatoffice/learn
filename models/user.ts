import mongoose, { Schema, model } from "mongoose";

/**
 * Whether an admin has let the user in. New sign-ins start "pending"; admins (ADMIN_EMAILS) are
 * always let in whatever this says. Users created before the field existed have none and count as
 * "approved", so turning the review on does not lock out existing accounts.
 */
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
    /** What the user told the admin while waiting for review. */
    requestNote: String,
    /** Shown to the user on the blocked screen. */
    blockReason: String,
    reviewedAt: Date,
    reviewedBy: String,
  },
  { timestamps: true },
);

export const User = mongoose.models.User || model("User", userSchema);
