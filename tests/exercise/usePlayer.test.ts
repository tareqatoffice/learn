import { describe, expect, it } from "vitest";
import type { PlanDay } from "@/features/exercise/plan";
import { playerReducer, saveFor, type PlayerState } from "@/features/exercise/lib/usePlayer";

const plan: PlanDay = {
  date: "2026-11-22",
  focus: "full",
  minutes: 20,
  items: [
    { exerciseId: "a", sets: 3, reps: 10, restSec: 30 },
    { exerciseId: "b", sets: 2, seconds: 20, restSec: 40 },
    { exerciseId: "c", sets: 2, reps: 8, restSec: 20 },
  ],
};
const work = (item: number, set: number, remaining = 0): PlayerState => ({ phase: "work", item, set, remaining });

describe("playerReducer", () => {
  it("moves to rest after a done set that is not the last", () => {
    expect(playerReducer(plan, work(0, 0), { type: "done" })).toEqual({ phase: "rest", item: 0, set: 1, remaining: 30 });
  });

  it("moves to rest with the next item after its last set, using the finished item rest", () => {
    expect(playerReducer(plan, work(0, 2), { type: "done" })).toEqual({ phase: "rest", item: 1, set: 0, remaining: 30 });
  });

  it("returns to work at the up-next set when the rest hits 0, starting a timed item clock", () => {
    const rest: PlayerState = { phase: "rest", item: 0, set: 1, remaining: 1 };
    expect(playerReducer(plan, rest, { type: "tick" })).toEqual(work(0, 1));
    const restB: PlayerState = { phase: "rest", item: 1, set: 0, remaining: 1 };
    expect(playerReducer(plan, restB, { type: "tick" })).toEqual(work(1, 0, 20));
  });

  it("ends in the summary after the last set of the last item", () => {
    expect(playerReducer(plan, work(2, 1), { type: "done" }).phase).toBe("summary");
  });

  it("goes back to the previous item last set from set 0", () => {
    expect(playerReducer(plan, work(1, 0, 5), { type: "back" })).toEqual(work(0, 2));
  });

  it("does nothing on back at the very start", () => {
    expect(playerReducer(plan, work(0, 0), { type: "back" })).toEqual(work(0, 0));
  });

  it("skip jumps to the next item or to the summary", () => {
    expect(playerReducer(plan, work(0, 1), { type: "skip" })).toEqual(work(1, 0, 20));
    expect(playerReducer(plan, work(2, 0), { type: "skip" }).phase).toBe("summary");
  });

  it("adds rest and skips rest", () => {
    const rest: PlayerState = { phase: "rest", item: 0, set: 1, remaining: 10 };
    expect(playerReducer(plan, rest, { type: "addRest", sec: 15 }).remaining).toBe(25);
    expect(playerReducer(plan, rest, { type: "skipRest" })).toEqual(work(0, 1));
  });

  it("counts a timed work set down and treats 0 as done", () => {
    expect(playerReducer(plan, work(1, 0, 5), { type: "tick" }).remaining).toBe(4);
    expect(playerReducer(plan, work(1, 0, 1), { type: "tick" })).toEqual({ phase: "rest", item: 1, set: 1, remaining: 40 });
  });
});

describe("saveFor", () => {
  it("names the item each change applies to", () => {
    expect(saveFor(plan, work(1, 0), { type: "done" })).toEqual({ index: 1, action: "done" });
    expect(saveFor(plan, work(1, 0), { type: "skip" })).toEqual({ index: 1, action: "skip" });
    expect(saveFor(plan, work(1, 0), { type: "back" })).toEqual({ index: 0, action: "back" });
    expect(saveFor(plan, work(0, 0), { type: "back" })).toBeNull();
    expect(saveFor(plan, work(1, 0, 1), { type: "tick" })).toEqual({ index: 1, action: "done" });
    expect(saveFor(plan, work(1, 0, 9), { type: "tick" })).toBeNull();
  });
});
