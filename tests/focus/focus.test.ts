import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/auth", () => ({
  auth: async () => (await import("../setup/session")).approvedSession(session.userId),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "UTC" }) }) }));

import * as actions from "@/app/(app)/focus-actions";
import { areaFor, focusContextFor, formatClock, formatDuration, isAppPath, offersFocus } from "@/features/focus/context";
import {
  elapsedSeconds,
  isCompleted,
  isDone,
  parseRun,
  pauseRun,
  remainingSeconds,
  resumeRun,
  startRun,
} from "@/features/focus/lib/timer";
import { getFocusToday, saveFocusSession } from "@/features/focus/sessions";
import { localDate } from "@/features/speaking/schedule";
import { connectDb } from "@/lib/db";
import { FocusSession } from "@/models";
import { resetDb } from "../setup/mongo";

const id = () => String(new Types.ObjectId());
const today = localDate(new Date(), "UTC");
const ctx = { area: "notes" as const, label: "Channels", path: "/notes/go/channels" };

describe("focus context", () => {
  it("offers focus only inside study tracks", () => {
    for (const p of ["/interview", "/speaking/x", "/ielts/plan", "/graphs/go", "/notes/go/ch1", "/coding/arrays"]) {
      expect(offersFocus(p)).toBe(true);
    }
    for (const p of ["/profile", "/admin", "/admin/users", "/dashboard", "/access", "/"]) {
      expect(offersFocus(p)).toBe(false);
    }
  });

  it("maps the first path segment to an area", () => {
    expect(areaFor("/notes/go/channels")).toBe("notes");
    expect(areaFor("/interview/react/q1")).toBe("interview");
    expect(areaFor("/dashboard")).toBe("general");
    expect(areaFor("/general")).toBe("general");
    expect(areaFor("/")).toBe("general");
  });

  it("labels from the title, then the heading, then the nav or area", () => {
    expect(focusContextFor("/notes/go/channels", { title: "Channels · Learn", heading: "H" }).label).toBe("Channels");
    expect(focusContextFor("/notes/go/channels", { title: "Learn", heading: "  Go   channels " }).label).toBe("Go channels");
    expect(focusContextFor("/dashboard", {}).label).toBe("Dashboard");
    expect(focusContextFor("/notes/x", {}).label).toBe("Notes");
  });

  it("accepts only in-app paths", () => {
    expect(isAppPath("/notes/a")).toBe(true);
    expect(isAppPath("/")).toBe(true);
    expect(isAppPath("//evil.test")).toBe(false);
    expect(isAppPath("/\\evil.test")).toBe(false);
    expect(isAppPath("https://evil.test")).toBe(false);
  });

  it("caps the label length", () => {
    expect(focusContextFor("/notes", { title: "x".repeat(500) }).label).toHaveLength(160);
  });

  it("formats clocks and durations", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(25 * 60)).toBe("25:00");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
    expect(formatDuration(30)).toBe("<1m");
    expect(formatDuration(12 * 60)).toBe("12m");
    expect(formatDuration(65 * 60)).toBe("1h 5m");
    expect(formatDuration(120 * 60)).toBe("2h");
  });
});

describe("focus timer", () => {
  it("counts elapsed time across pause and resume", () => {
    let run = startRun(ctx, 25, 0);
    expect(elapsedSeconds(run, 60_000)).toBe(60);
    run = pauseRun(run, 60_000);
    expect(elapsedSeconds(run, 600_000)).toBe(60);
    run = resumeRun(run, 600_000);
    expect(elapsedSeconds(run, 630_000)).toBe(90);
    expect(remainingSeconds(run, 630_000)).toBe(25 * 60 - 90);
  });

  it("finishes a timed run at its target and caps elapsed", () => {
    const run = startRun(ctx, 15, 0);
    expect(isDone(run, 15 * 60_000 - 1000)).toBe(false);
    expect(isDone(run, 15 * 60_000)).toBe(true);
    expect(elapsedSeconds(run, 99 * 60_000)).toBe(15 * 60);
  });

  it("open-ended runs have no remaining time and never count as completed", () => {
    const run = startRun(ctx, undefined, 0);
    expect(remainingSeconds(run, 5000)).toBeNull();
    expect(isDone(run, 60 * 60_000)).toBe(false);
    expect(isDone(run, 8 * 3600_000)).toBe(true);
    expect(isCompleted(run, 8 * 3600_000)).toBe(false);
    expect(isCompleted(startRun(ctx, 15, 0), 15 * 60_000)).toBe(true);
  });

  it("gives each run its own id and keeps the first start time", () => {
    const a = startRun(ctx, 25, 1000);
    const b = startRun(ctx, 25, 1000);
    expect(a.id).not.toBe(b.id);
    expect(resumeRun(pauseRun(a, 5000), 9000).firstStartedAt).toBe(1000);
  });

  it("parses stored runs and rejects junk", () => {
    const run = startRun(ctx, 25, 123);
    expect(parseRun(JSON.stringify(run))).toEqual(run);
    expect(parseRun(null)).toBeNull();
    expect(parseRun("{not json")).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, context: { ...ctx, area: "nope" } }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, elapsedMs: "1" }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, id: undefined }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, context: { ...ctx, path: "//evil.test" } }))).toBeNull();
  });
});

describe("focus sessions", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });
  afterAll(() => mongoose.disconnect());

  const now = new Date();
  const opts = { now, timeZone: "UTC" };
  const input = (over: Record<string, unknown> = {}) => ({
    ...ctx,
    runId: String(new Types.ObjectId()),
    startedAt: now.getTime() - 60_000,
    seconds: 60,
    ...over,
  });

  it("saves and groups today's sessions by page", async () => {
    const me = id();
    await saveFocusSession(me, input({ seconds: 600, targetMinutes: 25 }), opts);
    await saveFocusSession(me, input({ label: "Channels (renamed)", seconds: 300, completed: true }), opts);
    await saveFocusSession(me, input({ area: "coding", label: "Arrays", path: "/coding/arrays", seconds: 1200 }), opts);
    await saveFocusSession(id(), input({ seconds: 999 }), opts);

    const t = await getFocusToday(me, today);
    expect(t.totalSeconds).toBe(2100);
    expect(t.sessions).toBe(3);
    expect(t.items.map((i) => [i.path, i.seconds, i.sessions])).toEqual([
      ["/coding/arrays", 1200, 1],
      ["/notes/go/channels", 900, 2],
    ]);
    expect(t.items[1].label).toBe("Channels (renamed)");
  });

  it("saving the same run twice keeps one session", async () => {
    const me = id();
    const run = input({ seconds: 600 });
    await saveFocusSession(me, run, opts);
    await saveFocusSession(me, { ...run, seconds: 610, completed: true }, opts);
    expect(await FocusSession.countDocuments()).toBe(1);
    expect((await getFocusToday(me, today)).totalSeconds).toBe(610);
    // Another user may reuse the id without clashing.
    expect((await saveFocusSession(id(), run, opts)).ok).toBe(true);
  });

  it("dates a session by the day it started", async () => {
    const me = id();
    const at = new Date("2026-03-02T00:30:00Z");
    await saveFocusSession(me, input({ startedAt: Date.parse("2026-03-01T23:40:00Z"), seconds: 3000 }), { now: at, timeZone: "UTC" });
    expect((await getFocusToday(me, "2026-03-01")).totalSeconds).toBe(3000);
    expect((await getFocusToday(me, "2026-03-02")).totalSeconds).toBe(0);
  });

  it("rejects invalid input", async () => {
    const me = id();
    expect((await saveFocusSession(me, input({ seconds: 0 }), opts)).ok).toBe(false);
    expect((await saveFocusSession(me, input({ path: "https://evil.test" }), opts)).ok).toBe(false);
    expect((await saveFocusSession(me, input({ path: "//evil.test" }), opts)).ok).toBe(false);
    expect((await saveFocusSession(me, input({ area: "nope" }) as never, opts)).ok).toBe(false);
    expect((await saveFocusSession(me, input({ seconds: 9 * 3600 }), opts)).ok).toBe(false);
    expect((await saveFocusSession(me, input({ runId: "" }), opts)).ok).toBe(false);
    expect((await saveFocusSession(me, input({ startedAt: now.getTime() + 3600_000 }), opts)).ok).toBe(false);
    expect((await saveFocusSession(me, input({ startedAt: now.getTime() - 3 * 86_400_000 }), opts)).ok).toBe(false);
    expect(await FocusSession.countDocuments()).toBe(0);
  });

  it("actions use the session user, ignoring a smuggled userId", async () => {
    const me = id();
    session.userId = me;
    const res = await actions.saveFocusSessionAction({ ...input({ seconds: 120 }), userId: id() } as never);
    expect(res.ok).toBe(true);
    const doc = await FocusSession.findOne().lean<{ userId: Types.ObjectId; date: string }>();
    expect(String(doc?.userId)).toBe(me);
    expect(doc?.date).toBe(localDate(new Date(Date.now() - 60_000), "UTC"));
    expect((await actions.focusTodayAction()).totalSeconds).toBe(120);
  });

  it("actions need a signed-in user", async () => {
    await expect(actions.focusTodayAction()).rejects.toThrow();
  });
});
