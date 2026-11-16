import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { allow, RateLimit } from "@/lib/rateLimit";
import { resetDb } from "../setup/mongo";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

describe("rate limit (S8)", () => {
  it("allows max hits per window, per key, and starts over in the next window", async () => {
    const limit = { max: 2, windowSec: 60 };
    const t = new Date("2026-11-16T10:00:10Z");
    expect(await allow("k", limit, t)).toBe(true);
    expect(await allow("k", limit, t)).toBe(true);
    expect(await allow("k", limit, t)).toBe(false);
    expect(await allow("other", limit, t)).toBe(true);
    expect(await allow("k", limit, new Date("2026-11-16T10:01:05Z"))).toBe(true);
  });

  it("stores an expiry at the end of the window for the TTL index", async () => {
    await allow("k", { max: 5, windowSec: 60 }, new Date("2026-11-16T10:00:10Z"));
    const row = await RateLimit.findOne({ key: "k" }).lean<{ expiresAt: Date }>();
    expect(row?.expiresAt.toISOString()).toBe("2026-11-16T10:01:00.000Z");
  });
});
