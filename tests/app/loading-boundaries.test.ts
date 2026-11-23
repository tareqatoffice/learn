import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.join(process.cwd(), "app", "(app)");

const sections = readdirSync(APP, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe("signed-in loading boundaries", () => {
  // A group-level loading.tsx shows first, then the section's own one replaces it,
  // so every navigation flashed two different skeletons.
  it("has no group-level loading screen above the sections", () => {
    expect(existsSync(path.join(APP, "loading.tsx"))).toBe(false);
  });

  it.each(sections)("section %s has its own loading screen", (section) => {
    expect(existsSync(path.join(APP, section, "loading.tsx"))).toBe(true);
  });
});
