import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { saveAppSettings } from "@/features/admin/appSettings";
import { DEFAULT_APP_SETTINGS, getAppSettings, resolveAppSettings } from "@/lib/appSettings";
import { connectDb } from "@/lib/db";
import { resetDb } from "../setup/mongo";

describe("resolveAppSettings", () => {
  it("falls back to the defaults for missing or malformed values", () => {
    expect(resolveAppSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
    expect(resolveAppSettings({ focusPresets: [0, 25], exerciseRotation: ["stretch"] })).toEqual(DEFAULT_APP_SETTINGS);
    expect(resolveAppSettings({ focusPresets: [10, 20], exerciseRotation: ["core"] })).toEqual({
      focusPresets: [10, 20],
      exerciseRotation: ["core"],
    });
  });
});

describe("app settings", () => {
  beforeAll(() => connectDb());
  beforeEach(() => resetDb());
  afterAll(() => mongoose.disconnect());

  it("saves sorted presets and a rotation, and reads them back", async () => {
    expect(await getAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
    expect(await saveAppSettings({ focusPresets: [45, 10], exerciseRotation: ["upper", "core"] })).toEqual({ ok: true });
    expect(await getAppSettings()).toEqual({ focusPresets: [10, 45], exerciseRotation: ["upper", "core"] });
  });

  it("rejects bad presets and rotations with field errors", async () => {
    const result = await saveAppSettings({ focusPresets: [25, 25, Number.NaN, 5], exerciseRotation: ["stretch"] });
    expect(result).toMatchObject({ ok: false, errors: { focusPresets: expect.any(String), exerciseRotation: expect.any(String) } });
    expect(await saveAppSettings({ focusPresets: [], exerciseRotation: [] })).toMatchObject({ ok: false });
    expect(await getAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });
});
