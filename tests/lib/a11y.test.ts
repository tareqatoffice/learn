import { describe, expect, it } from "vitest";
import { rovingIndex, timeWarning } from "@/lib/a11y";

describe("a11y helpers (U14)", () => {
  it("announces five minutes and one minute left, once each", () => {
    expect(timeWarning(400)).toBe("");
    expect(timeWarning(300)).toBe("Five minutes left.");
    expect(timeWarning(61)).toBe("Five minutes left.");
    expect(timeWarning(60)).toBe("One minute left.");
    expect(timeWarning(0)).toBe("");
    expect(timeWarning(null)).toBe("");
  });

  it("moves with arrows, wraps, and jumps with Home and End", () => {
    expect(rovingIndex("ArrowRight", 2, 3)).toBe(0);
    expect(rovingIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(rovingIndex("ArrowDown", 0, 3)).toBe(1);
    expect(rovingIndex("End", 0, 3)).toBe(2);
    expect(rovingIndex("Home", 2, 3)).toBe(0);
    expect(rovingIndex("a", 0, 3)).toBeNull();
  });
});
