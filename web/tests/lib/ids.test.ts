import { describe, expect, it } from "vitest";
import { fnv1a, importKey, slugify } from "@/lib/ids";

describe("fnv1a", () => {
  it("returns the base-36 offset basis for the empty string", () => {
    expect(fnv1a("")).toBe((0x811c9dc5).toString(36));
  });
});

describe("importKey", () => {
  it("matches the id collect() gives the legacy question", () => {
    // Hard-coded from quiz-app/src/lib/collect.js: the React book's "What is React?".
    expect(importKey("react-questions-ebook", "What is React?", "")).toBe(
      "react-questions-ebook-1a2oeen",
    );
  });
});

describe("slugify", () => {
  it("lowercases and collapses punctuation into single hyphens", () => {
    expect(slugify("Part 1 — Fundamentals")).toBe("part-1-fundamentals");
  });
});
