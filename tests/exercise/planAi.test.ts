import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { allowedFor } from "@/features/exercise/library";
import { fillDay, type SkeletonDay } from "@/features/exercise/plan";
import { codeNote, fillWeek } from "@/features/exercise/planAi";
import { saveAiSettings } from "@/features/ai/lib/aiSettings";
import { consumeAiCall } from "@/features/progress/quizAi";
import { resetDb } from "../setup/mongo";
import { newUserId } from "../progress/seed";

const day = (date: string): SkeletonDay => ({
  date,
  focus: "full",
  minutes: 30,
  maxDifficulty: 2,
  slots: 3,
  sets: 2,
  restSec: 30,
  reps: 10,
  seconds: 30,
});
const skeleton = [day("2026-11-23"), day("2026-11-25")];
const ids = allowedFor("full", 2)
  .filter((e) => e.mode === "reps")
  .slice(0, 3)
  .map((e) => e.id);
const goodItems = ids.map((exerciseId) => ({ exerciseId, sets: 2, reps: 10, restSec: 30 }));
const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));
const base = (userId: string) => ({ userId, skeleton, weekIdx: 0, profileSummary: "beginner", lastWeek: [] });

describe("fillWeek", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.stubEnv("OPENROUTER_DAILY_LIMIT", "5");
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetEnvCache();
  });
  afterAll(() => mongoose.disconnect());

  it("formats the code note", () => {
    expect(codeNote({ weekIdx: 3, deload: true, workouts: 3 })).toBe("Week 4: lighter week to recover. 3 workouts.");
  });

  it("returns nothing for an empty skeleton without calling the AI", async () => {
    const fetch = vi.fn();
    const out = await fillWeek({ ...base(newUserId()), skeleton: [], fetch });
    expect(out).toMatchObject({ days: [], source: "code" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses code fill when AI is off", async () => {
    const user = newUserId();
    await saveAiSettings({ enabled: false, primaryModel: "a/b:free", fallbackModel: "", dailyLimit: 0 }, user);
    const fetch = vi.fn();
    const out = await fillWeek({ ...base(user), fetch });
    expect(out.source).toBe("code");
    expect(out.days).toHaveLength(skeleton.length);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps valid AI days and replaces invalid ones", async () => {
    const user = newUserId();
    const body = {
      days: [
        { date: "2026-11-23", items: goodItems },
        { date: "2026-11-25", items: [{ exerciseId: "nope", sets: 2, reps: 10, restSec: 30 }] },
      ],
      coachNote: "  Nice work.  ",
    };
    const fetch = vi.fn(async () => reply(JSON.stringify(body)));
    const out = await fillWeek({ ...base(user), fetch: fetch as unknown as typeof globalThis.fetch });
    expect(out.source).toBe("ai");
    expect(out.coachNote).toBe("Nice work.");
    expect(out.days[0].items).toEqual(goodItems);
    expect(out.days[1]).toEqual(fillDay(skeleton[1], user + skeleton[1].date));
  });

  it("falls back when the reply is not JSON", async () => {
    const user = newUserId();
    const out = await fillWeek({ ...base(user), fetch: async () => reply("sorry, no") });
    expect(out.source).toBe("code");
    expect(out.days[0]).toEqual(fillDay(skeleton[0], user + skeleton[0].date));
  });

  it("falls back when fetch rejects", async () => {
    const out = await fillWeek({
      ...base(newUserId()),
      fetch: async () => {
        throw new Error("offline");
      },
    });
    expect(out.source).toBe("code");
    expect(out.days).toHaveLength(2);
  });

  it("falls back when the daily limit is used up", async () => {
    const user = newUserId();
    await saveAiSettings({ enabled: true, primaryModel: "a/b:free", fallbackModel: "", dailyLimit: 1 }, user);
    await consumeAiCall(user, 1);
    const fetch = vi.fn(async () => reply(JSON.stringify({ days: [], coachNote: "x" })));
    const out = await fillWeek({ ...base(user), fetch: fetch as unknown as typeof globalThis.fetch });
    expect(out.source).toBe("code");
    expect(fetch).not.toHaveBeenCalled();
  });
});
