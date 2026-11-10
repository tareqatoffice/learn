import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import {
  getDefaults,
  getEffectiveSettings,
  saveDefaults,
  saveProfile,
  setBodyConsent,
} from "@/speaking/settings";
import { DEFAULT_TARGET_MIN } from "@/speaking/tasks";
import { resetDb } from "../setup/mongo";

const user = () => String(new Types.ObjectId());

describe("speaking settings", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("falls back to the built-in defaults", async () => {
    expect(await getDefaults()).toEqual(DEFAULT_TARGET_MIN);
    const s = await getEffectiveSettings(user());
    expect(s.targets).toEqual(DEFAULT_TARGET_MIN);
    expect(s.enabled).toEqual({ shadowing: true, readAloud: true, recordReview: true });
    expect(s.bodyConsent).toBe(false);
  });

  it("profile targets override admin defaults", async () => {
    const u = user();
    expect((await saveDefaults({ shadowing: 15, readAloud: 5, recordReview: 2 })).ok).toBe(true);
    expect((await saveProfile(u, { targets: { shadowing: 20 }, enabled: { readAloud: false } })).ok).toBe(true);
    const s = await getEffectiveSettings(u);
    expect(s.targets).toEqual({ shadowing: 20, readAloud: 5, recordReview: 2 });
    expect(s.enabled.readAloud).toBe(false);
    expect(s.video.recordReview).toBe(true);
  });

  it("rejects a target of 0 or 121", async () => {
    expect((await saveDefaults({ shadowing: 0, readAloud: 5, recordReview: 2 })).ok).toBe(false);
    expect((await saveDefaults({ shadowing: 121, readAloud: 5, recordReview: 2 })).ok).toBe(false);
    expect((await saveDefaults({ shadowing: 1.5, readAloud: 5, recordReview: 2 })).ok).toBe(false);
    const u = user();
    expect((await saveProfile(u, { targets: { readAloud: 0 } })).ok).toBe(false);
    expect((await saveProfile(u, { targets: { readAloud: 121 } })).ok).toBe(false);
  });

  it("records body consent", async () => {
    const u = user();
    await setBodyConsent(u, true);
    expect((await getEffectiveSettings(u)).bodyConsent).toBe(true);
    await setBodyConsent(u, false);
    expect((await getEffectiveSettings(u)).bodyConsent).toBe(false);
  });
});
