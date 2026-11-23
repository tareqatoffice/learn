import mongoose, { Schema, model } from "mongoose";
import { FOCUSES } from "@/models/exerciseConstants";

/** Site-wide tunables an admin can change without a deploy. Missing fields fall back to the defaults in lib/appSettingsConfig.ts. */
const appSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    focusPresets: { type: [Number], default: undefined },
    exerciseRotation: { type: [{ type: String, enum: FOCUSES }], default: undefined },
  },
  { timestamps: true },
);

export const AppSettings = mongoose.models.AppSettings || model("AppSettings", appSettingsSchema);
