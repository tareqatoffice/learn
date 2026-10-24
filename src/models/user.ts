import mongoose, { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    image: String,
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export const User = mongoose.models.User || model("User", userSchema);
