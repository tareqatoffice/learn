import { describe, expect, it } from "vitest";
import {
  CRITERIA,
  CRITERION_LABEL,
  SKILLS,
  isHalfBand,
  isWholeBand,
  listeningBand,
  overallBand,
  readingBand,
  roundHalf,
  speakingBand,
} from "@/ielts/bands";

describe("roundHalf", () => {
  it("rounds at the quarter boundaries", () => {
    expect(roundHalf(6.125)).toBe(6);
    expect(roundHalf(6.2499)).toBe(6);
    expect(roundHalf(6.25)).toBe(6.5);
    expect(roundHalf(6.625)).toBe(6.5);
    expect(roundHalf(6.7499)).toBe(6.5);
    expect(roundHalf(6.75)).toBe(7);
    expect(roundHalf(7)).toBe(7);
    expect(roundHalf(6.5)).toBe(6.5);
  });
});

describe("overallBand / speakingBand", () => {
  it("averages four skills then rounds", () => {
    expect(overallBand({ listening: 6.5, reading: 6.5, writing: 5, speaking: 7 })).toBe(6.5);
    expect(overallBand({ listening: 6.5, reading: 6.5, writing: 6.5, speaking: 7 })).toBe(6.5);
    expect(overallBand({ listening: 7, reading: 7, writing: 6.5, speaking: 7 })).toBe(7);
    expect(overallBand({ listening: 6, reading: 6, writing: 6, speaking: 6.5 })).toBe(6);
  });
  it("averages four criteria then rounds", () => {
    expect(speakingBand({ fluency: 6, lexical: 6, grammar: 6, pronunciation: 7 })).toBe(6.5);
    expect(speakingBand({ fluency: 6, lexical: 6, grammar: 6, pronunciation: 6 })).toBe(6);
    expect(speakingBand({ fluency: 7, lexical: 7, grammar: 7, pronunciation: 6 })).toBe(7);
    expect(speakingBand({ fluency: 6, lexical: 7, grammar: 6, pronunciation: 6 })).toBe(6.5);
  });
});

describe("raw score conversion", () => {
  it("converts listening", () => {
    expect(listeningBand(30)).toBe(7);
    expect(listeningBand(29)).toBe(6.5);
    expect(listeningBand(40)).toBe(9);
    expect(listeningBand(0)).toBe(0);
  });
  it("converts reading", () => {
    expect(readingBand(33)).toBe(7.5);
    expect(readingBand(32)).toBe(7);
    expect(readingBand(0)).toBe(0);
  });
  it("rejects out-of-range or non-integer raws", () => {
    expect(() => listeningBand(41)).toThrow(RangeError);
    expect(() => readingBand(-1)).toThrow(RangeError);
    expect(() => readingBand(3.5)).toThrow(RangeError);
    expect(() => listeningBand(Number.NaN)).toThrow(RangeError);
  });
});

describe("helpers", () => {
  it("detects half and whole bands", () => {
    expect(isHalfBand(6.5)).toBe(true);
    expect(isHalfBand(6)).toBe(true);
    expect(isHalfBand(6.25)).toBe(false);
    expect(isWholeBand(6)).toBe(true);
    expect(isWholeBand(6.5)).toBe(false);
  });
  it("exposes constants", () => {
    expect(SKILLS).toEqual(["listening", "reading", "writing", "speaking"]);
    expect(CRITERIA).toEqual(["fluency", "lexical", "grammar", "pronunciation"]);
    expect(CRITERION_LABEL.grammar).toBe("Grammatical Range and Accuracy");
    expect(CRITERION_LABEL.fluency).toBe("Fluency and Coherence");
  });
});
