import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({ storageConfigured: vi.fn(() => true) }));
vi.mock("@/lib/stt", () => ({ sttConfigured: vi.fn(() => true) }));

import { connectDb } from "@/lib/db";
import { SpeakingTake } from "@/models";
import { getToday, getTrends } from "@/speaking/progress";
import type { TaskKey } from "@/speaking/tasks";
import { resetDb } from "../setup/mongo";

const user = () => String(new Types.ObjectId());

async function take(
  userId: string,
  date: string,
  task: TaskKey,
  minutes: number,
  extra: Record<string, unknown> = {},
  stored = true,
) {
  await SpeakingTake.create({
    userId,
    date,
    task,
    media: { kind: "audio", key: "k", mime: "audio/webm", durationSec: minutes * 60, capSec: 900, stored },
    ...extra,
  });
}

describe("speaking progress", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  const now = new Date("2026-11-10T12:00:00Z");

  it("getToday sums minutes per task and marks done at target", async () => {
    const u = user();
    await take(u, "2026-11-10", "shadowing", 10);
    await take(u, "2026-11-10", "shadowing", 6);
    const t = await getToday(u, "UTC", now);
    expect(t.date).toBe("2026-11-10");
    expect(t.minutes.shadowing).toBe(16);
    expect(t.done.shadowing).toBe(true);
    expect(t.done.readAloud).toBe(false);
    expect(t.storage).toBe(true);
    expect(t.week).toHaveLength(7);
  });

  it("unstored takes don't count", async () => {
    const u = user();
    await take(u, "2026-11-10", "shadowing", 20, {}, false);
    const t = await getToday(u, "UTC", now);
    expect(t.minutes.shadowing ?? 0).toBe(0);
    expect(t.done.shadowing).toBe(false);
    expect(t.streak).toBe(0);
  });

  it("other users' takes don't count", async () => {
    await take(user(), "2026-11-10", "shadowing", 20);
    const t = await getToday(user(), "UTC", now);
    expect(t.minutes.shadowing ?? 0).toBe(0);
  });

  it("week fractions and streak use local dates", async () => {
    const u = user();
    // 2026-11-10 20:00 UTC is already 11-11 in Dhaka (UTC+6).
    const late = new Date("2026-11-10T20:00:00Z");
    await take(u, "2026-11-11", "shadowing", 15);
    await take(u, "2026-11-10", "readAloud", 5);
    await take(u, "2026-11-09", "recordReview", 2);
    const t = await getToday(u, "Asia/Dhaka", late);
    expect(t.date).toBe("2026-11-11");
    expect(t.streak).toBe(3);
    expect(t.best).toBe(3);
    expect(t.week.find((d) => d.date === "2026-11-11")!.fraction).toBeCloseTo(15 / 22);
    expect(t.week.find((d) => d.date === "2026-11-10")!.fraction).toBeCloseTo(5 / 22);
  });

  it("getTrends averages ratings per day and rounds to one decimal", async () => {
    const u = user();
    await take(u, "2026-11-10", "readAloud", 1.5, {
      self: { fluency: 3, confidence: 4 },
      ai: { speech: { fluency: 4, vocabulary: 3 }, body: { confidence: 5 } },
    });
    await take(u, "2026-11-10", "readAloud", 1.5, { self: { fluency: 4, confidence: 4 } });
    await take(u, "2026-11-10", "readAloud", 1, { self: { fluency: 4 } });
    await take(user(), "2026-11-10", "readAloud", 9, { self: { fluency: 1 } });
    const trend = await getTrends(u, 3, "UTC", now);
    expect(trend.map((d) => d.date)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(trend[0]).toEqual({ date: "2026-11-08", minutes: 0, self: {}, ai: {} });
    expect(trend[2].minutes).toBe(4);
    expect(trend[2].self).toEqual({ fluency: 3.7, confidence: 4 });
    expect(trend[2].ai).toEqual({ fluency: 4, vocabulary: 3, confidence: 5 });
  });
});
