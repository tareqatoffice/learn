import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allowedFor, EXERCISES, exerciseById, exerciseImage } from "@/features/exercise/library";
import { FOCUSES } from "@/models/exerciseConstants";

describe("exercise library", () => {
  it("ids are unique kebab-case", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("every exercise has 1–3 cues and equipment none", () => {
    for (const e of EXERCISES) {
      expect(e.cues.length).toBeGreaterThanOrEqual(1);
      expect(e.cues.length).toBeLessThanOrEqual(3);
      expect(e.equipment).toBe("none");
    }
  });

  it("each focus has at least 3 exercises at difficulty 1", () => {
    for (const f of FOCUSES) expect(allowedFor(f, 1).length).toBeGreaterThanOrEqual(3);
  });

  it("at least 30 exercises total", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(30);
  });

  it("every frames path exists under public/", () => {
    for (const e of EXERCISES) {
      if (!e.frames) continue;
      for (const f of e.frames) expect(existsSync(path.join(process.cwd(), "public", f)), f).toBe(true);
    }
  });

  it("looks up by id, filters by difficulty and falls back to the placeholder", () => {
    expect(exerciseById("plank")?.name).toBe("Plank");
    expect(exerciseById("nope")).toBeUndefined();
    expect(allowedFor("core", 1).every((e) => e.difficulty === 1 && e.focus.includes("core"))).toBe(true);
    const burpee = exerciseById("burpee")!;
    expect(exerciseImage(burpee, 0)).toBe("/assets/exercise/placeholder.svg");
    expect(exerciseImage(exerciseById("plank")!, 1)).toBe("/assets/exercise/plank/1.jpg");
  });
});
