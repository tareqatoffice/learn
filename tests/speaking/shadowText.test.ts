import { describe, expect, it } from "vitest";
import { isClipRate, sentenceAt, splitSentences, timeline, validMarks } from "@/features/speaking/shadowText";

describe("shadowing text timeline", () => {
  it("splits text into sentences on end punctuation and line breaks", () => {
    expect(splitSentences('Hi there. How are you? "Fine!" she said\nNew line… ok')).toEqual([
      "Hi there.",
      "How are you?",
      '"Fine!"',
      "she said",
      "New line…",
      "ok",
    ]);
    expect(splitSentences("   ")).toEqual([]);
  });

  it("estimates sentence times from their length when there are no marks", () => {
    const t = timeline("Aaaa. Bbbbbbbbbbbbbb.", 20);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ start: 0, end: 5 });
    expect(t[1]).toMatchObject({ start: 5, end: 20 });
  });

  it("uses valid admin marks, and falls back when they don't fit", () => {
    expect(timeline("A. B. C.", 30, [0.5, 10, 20]).map((s) => [s.start, s.end])).toEqual([
      [0.5, 10],
      [10, 20],
      [20, 30],
    ]);
    expect(timeline("A. B.", 30, [0, 10, 20])[1].start).toBe(15);
    expect(validMarks([0, 5, 5], 3, 30)).toBe(false);
    expect(validMarks([0, 5, 40], 3, 30)).toBe(false);
    expect(validMarks([0, 5, 9], 3, 0)).toBe(true);
  });

  it("finds the sentence playing at a time", () => {
    const t = timeline("A. B. C.", 30, [1, 10, 20]);
    expect(sentenceAt(t, 0)).toBe(0);
    expect(sentenceAt(t, 10)).toBe(1);
    expect(sentenceAt(t, 29)).toBe(2);
    expect(sentenceAt([], 3)).toBe(-1);
  });

  it("accepts only the offered clip speeds", () => {
    expect(isClipRate(0.75)).toBe(true);
    expect(isClipRate(1)).toBe(true);
    expect(isClipRate(0.3)).toBe(false);
    expect(isClipRate("1")).toBe(false);
  });
});
