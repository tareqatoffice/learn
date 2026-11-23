import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { allowedFor, exerciseImage, PHOTO_KEY, PLACEHOLDER } from "@/features/exercise/catalog";
import { listExercises, toExercise } from "@/features/exercise/library";
import { Exercise } from "@/models";
import { FOCUSES } from "@/models/exerciseConstants";
import { resetDb } from "../setup/mongo";
import { EXERCISES, seedExercises } from "./fixtures";

describe("starter exercise library", () => {
  it("ids are unique kebab-case", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("every exercise has 1–3 cues", () => {
    for (const e of EXERCISES) {
      expect(e.cues.length).toBeGreaterThanOrEqual(1);
      expect(e.cues.length).toBeLessThanOrEqual(3);
    }
  });

  it("each focus has at least 3 exercises at difficulty 1", () => {
    for (const f of FOCUSES) expect(allowedFor(EXERCISES, f, 1).length).toBeGreaterThanOrEqual(3);
  });

  it("seed photo folders hold both a start and an end photo", () => {
    for (const e of EXERCISES) {
      const dir = path.join(process.cwd(), "scripts/data/exercise-images", e.id);
      if (existsSync(dir)) expect(existsSync(path.join(dir, "0.jpg")) && existsSync(path.join(dir, "1.jpg")), e.id).toBe(true);
    }
    expect(EXERCISES.length).toBeGreaterThanOrEqual(30);
  });
});

describe("catalog helpers", () => {
  const plank = EXERCISES.find((e) => e.id === "plank")!;

  it("filters by focus and difficulty and skips archived moves", () => {
    expect(allowedFor(EXERCISES, "core", 1).every((e) => e.difficulty === 1 && e.focus.includes("core"))).toBe(true);
    const archived = EXERCISES.map((e) => (e.id === plank.id ? { ...e, archived: true } : e));
    expect(allowedFor(archived, "core", 3).some((e) => e.id === plank.id)).toBe(false);
  });

  it("falls back to the placeholder and to the start photo", () => {
    expect(exerciseImage(plank, 0)).toBe(PLACEHOLDER);
    expect(exerciseImage({ ...plank, photos: ["/media/a.jpg"] }, 1)).toBe("/media/a.jpg");
    expect(exerciseImage({ ...plank, photos: ["/media/a.jpg", "/media/b.jpg"] }, 1)).toBe("/media/b.jpg");
  });

  it("accepts only exercise photo keys", () => {
    expect(PHOTO_KEY.test("exercise/plank/0123456789abcdef0123.jpg")).toBe(true);
    expect(PHOTO_KEY.test("lessons/x/0123456789abcdef0123.jpg")).toBe(false);
    expect(PHOTO_KEY.test("exercise/../secret/0123456789abcdef0123.jpg")).toBe(false);
  });
});

describe("listExercises", () => {
  beforeEach(async () => {
    await resetDb();
    await seedExercises();
  });

  it("turns photo keys into /media URLs when storage is configured", () => {
    const row = { slug: "plank", name: "Plank", type: "strength", difficulty: 1, mode: "time", startPhoto: "exercise/plank/aa.jpg" } as const;
    expect(toExercise(row, true).photos).toEqual(["/media/exercise/plank/aa.jpg"]);
    expect(toExercise(row, false).photos).toEqual([]);
  });

  it("loads every exercise in library order", async () => {
    await Exercise.updateOne({ slug: "plank" }, { $set: { startPhoto: "exercise/plank/aa.jpg", archived: true } });
    const list = await listExercises();
    expect(list.map((e) => e.id)).toEqual(EXERCISES.map((e) => e.id));
    const plank = list.find((e) => e.id === "plank")!;
    expect(plank.photos).toEqual([]); // no R2 in tests
    expect(plank.archived).toBe(true);
  });
});
