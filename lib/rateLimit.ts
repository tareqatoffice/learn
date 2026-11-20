import mongoose, { Schema, model } from "mongoose";
import { headers } from "next/headers";
import { connectDb, retryOnDuplicateKey } from "@/lib/db";
import { getEnv } from "@/lib/env";

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

export const LIMITS = {
  signIn: { max: 20, windowSec: 10 * 60 },
  access: { max: 20, windowSec: 10 * 60 },
  search: { max: 120, windowSec: 60 },
} satisfies Record<string, Limit>;

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

export function addressFrom(h: Pick<Headers, "get">, { vercel }: { vercel: boolean }): string {
  if (vercel) {
    const edge = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (edge) return edge;
  }
  const hops = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.at(-1) ?? h.get("x-real-ip")?.trim() ?? "unknown";
}

export async function clientAddress(): Promise<string> {
  return addressFrom(await headers(), { vercel: getEnv().VERCEL });
}

export const RATE_LIMIT_MESSAGE = "Too many tries in a short time. Wait a few minutes and try again.";
