import { describe, expect, it } from "vitest";
import type { PlanDay } from "@/features/exercise/plan";
import { initialPlayerState, playerReducer, saveFor, type PlayerEvent, type PlayerState } from "@/features/exercise/lib/usePlayer";

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
const work = (item: number, set: number, remaining = 0): PlayerState => ({
  ...initialPlayerState(plan, { item, set }),
  remaining,
});
const rest = (item: number, set: number, remaining: number): PlayerState => ({ ...work(item, set), phase: "rest", remaining });
const at = (item: number, set: number, remaining = 0) => ({ phase: "work", item, set, remaining });

describe("playerReducer", () => {
  it("moves to rest after a done set that is not the last", () => {
    expect(playerReducer(plan, work(0, 0), { type: "done" })).toMatchObject({ phase: "rest", item: 0, set: 1, remaining: 30 });
  });

  it("moves to rest with the next item after its last set, using the finished item rest", () => {
    expect(playerReducer(plan, work(0, 2), { type: "done" })).toMatchObject({ phase: "rest", item: 1, set: 0, remaining: 30 });
  });

  it("returns to work at the up-next set when the rest hits 0, starting a timed item clock", () => {
    const r = rest(0, 1, 1);
    expect(playerReducer(plan, r, { type: "tick" })).toMatchObject(at(0, 1));
    const restB = rest(1, 0, 1);
    expect(playerReducer(plan, restB, { type: "tick" })).toMatchObject(at(1, 0, 20));
  });

  it("ends in the summary after the last set of the last item", () => {
    expect(playerReducer(plan, work(2, 1), { type: "done" }).phase).toBe("summary");
  });

  it("goes back to the previous item last set from set 0", () => {
    expect(playerReducer(plan, work(1, 0, 5), { type: "back" })).toMatchObject(at(0, 2));
  });

  it("does nothing on back at the very start", () => {
    expect(playerReducer(plan, work(0, 0), { type: "back" })).toMatchObject(at(0, 0));
  });

  it("skip jumps to the next item or to the summary", () => {
    expect(playerReducer(plan, work(0, 1), { type: "skip" })).toMatchObject(at(1, 0, 20));
    expect(playerReducer(plan, work(2, 0), { type: "skip" }).phase).toBe("summary");
  });

  it("adds rest and skips rest", () => {
    const r = rest(0, 1, 10);
    expect(playerReducer(plan, r, { type: "addRest", sec: 15 }).remaining).toBe(25);
    expect(playerReducer(plan, r, { type: "skipRest" })).toMatchObject(at(0, 1));
  });

  it("counts a timed work set down and treats 0 as done", () => {
    expect(playerReducer(plan, work(1, 0, 5), { type: "tick" }).remaining).toBe(4);
    expect(playerReducer(plan, work(1, 0, 1), { type: "tick" })).toMatchObject({ phase: "rest", item: 1, set: 1, remaining: 40 });
  });
});

describe("Back stays in step with the saved sets", () => {
  it("back after a skip lands on the set the server would resume at", () => {
    let s = work(0, 0);
    s = playerReducer(plan, s, { type: "done" }); // A set 1 done, rest
    s = playerReducer(plan, s, { type: "skipRest" });
    expect(saveFor(plan, s, { type: "skip" })).toEqual({ index: 0, action: "skip" });
    s = playerReducer(plan, s, { type: "skip" }); // A skipped with 1 set done, now on B
    expect(s).toMatchObject(at(1, 0, 20));
    expect(saveFor(plan, s, { type: "back" })).toEqual({ index: 0, action: "back" });
    // server: setsDone 1 -> 0, skipped cleared -> resume A set 0
    expect(playerReducer(plan, s, { type: "back" })).toMatchObject(at(0, 0));
  });

  it("back within an item after two done sets shows set 1", () => {
    let s = work(0, 0);
    for (let n = 0; n < 2; n++) {
      s = playerReducer(plan, s, { type: "done" });
      s = playerReducer(plan, s, { type: "skipRest" });
    }
    expect(s).toMatchObject(at(0, 2));
    expect(playerReducer(plan, s, { type: "back" })).toMatchObject(at(0, 1));
  });

  type Srv = { setsDone: number; skipped: boolean }[];
  const serverApply = (srv: Srv, { index, action }: { index: number; action: "done" | "skip" | "back" }) => {
    const it = srv[index];
    if (action === "done") it.setsDone = Math.min(plan.items[index].sets, it.setsDone + 1);
    else if (action === "skip") it.skipped = true;
    else {
      it.setsDone = Math.max(0, it.setsDone - 1);
      it.skipped = false;
    }
  };
  const serverResume = (srv: Srv) => {
    for (let i = 0; i < plan.items.length; i++) {
      if (!srv[i].skipped && srv[i].setsDone < plan.items[i].sets) return { item: i, set: srv[i].setsDone };
    }
    return null;
  };
  const sequences: PlayerEvent["type"][][] = [
    ["done", "skipRest", "skip", "back", "back"],
    ["done", "skipRest", "done", "skipRest", "done", "back", "back", "back"],
    ["skip", "back", "done", "skipRest", "skip", "skip", "back"],
    ["done", "skipRest", "done", "skipRest", "done", "skipRest", "skip", "back", "done", "skipRest"],
    ["back", "done", "back", "back", "skip", "back", "done"],
  ];
  it.each(sequences)("client position equals the server resume point (%#)", (...seq) => {
    let s = work(0, 0);
    const srv: Srv = plan.items.map(() => ({ setsDone: 0, skipped: false }));
    for (const type of seq) {
      const event = { type } as PlayerEvent;
      const save = saveFor(plan, s, event);
      if (save) serverApply(srv, save);
      s = playerReducer(plan, s, event);
      const expected = serverResume(srv);
      if (s.phase === "rest") continue; // up-next is shown, the server position is the same
      if (!expected) expect(s.phase).toBe("summary");
      else expect(s).toMatchObject({ item: expected.item, set: expected.set });
    }
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
