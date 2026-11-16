import mongoose, { Schema, model } from "mongoose";
import { headers } from "next/headers";
import { connectDb, retryOnDuplicateKey } from "@/lib/db";

// A fixed-window counter per key, in Mongo so every server instance shares it. Rows delete
// themselves (TTL index) when their window is over. Not in @/models or backups: nothing here is
// worth keeping.
const rateLimitSchema = new Schema({
  key: { type: String, required: true },
  window: { type: Number, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
rateLimitSchema.index({ key: 1, window: 1 }, { unique: true });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = mongoose.models.RateLimit || model("RateLimit", rateLimitSchema);

export type Limit = { max: number; windowSec: number };

/** Sign-in attempts per address, access-page actions per user, palette searches per user. */
export const LIMITS = {
  signIn: { max: 20, windowSec: 10 * 60 },
  access: { max: 20, windowSec: 10 * 60 },
  search: { max: 120, windowSec: 60 },
} satisfies Record<string, Limit>;

/** Counts one hit for `key`; false once more than `max` hits fell in the current window. */
export async function allow(key: string, limit: Limit, now: Date = new Date()): Promise<boolean> {
  await connectDb();
  const span = limit.windowSec * 1000;
  const window = Math.floor(now.getTime() / span);
  const row = await retryOnDuplicateKey(() =>
    RateLimit.findOneAndUpdate(
      { key, window },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * span) } },
      { upsert: true, returnDocument: "after" },
    ).lean<{ count: number }>(),
  );
  return (row?.count ?? 0) <= limit.max;
}

/** The caller's address as the platform forwards it (first hop of X-Forwarded-For), for keys only. */
export async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export const RATE_LIMIT_MESSAGE = "Too many tries in a short time. Wait a few minutes and try again.";
