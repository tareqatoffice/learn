import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveSet = vi.hoisted(() => vi.fn());
const finish = vi.hoisted(() => vi.fn());
const lib = vi.hoisted(() => ({ nullFrames: false }));
vi.mock("@/app/(app)/exercise/actions", () => ({ saveSetAction: saveSet, finishSessionAction: finish }));
vi.mock("@/features/exercise/library", async (orig) => {
  const real = await orig<typeof import("@/features/exercise/library")>();
  return {
    ...real,
    exerciseById: (id: string) => {
      const e = real.exerciseById(id);
      return e && lib.nullFrames ? { ...e, frames: null } : e;
    },
  };
});

import { WorkoutPlayer } from "@/features/exercise/components/WorkoutPlayer";
import { EXERCISES } from "@/features/exercise/library";
import type { PlanDay } from "@/features/exercise/plan";

const reps = EXERCISES.filter((e) => e.mode === "reps");
const timed = EXERCISES.find((e) => e.mode === "time")!;
const plan: PlanDay = {
  date: "2026-11-22",
  focus: "full",
  minutes: 20,
  items: [
    { exerciseId: reps[0].id, sets: 3, reps: 10, restSec: 30 },
    { exerciseId: reps[1].id, sets: 3, reps: 12, restSec: 30 },
    { exerciseId: timed.id, sets: 2, seconds: 30, restSec: 20 },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  saveSet.mockResolvedValue({});
  finish.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  lib.nullFrames = false;
  saveSet.mockReset();
  finish.mockReset();
});

describe("WorkoutPlayer", () => {
  it("starts at the resume point", () => {
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 1, set: 1 }} />);
    expect(screen.getByRole("heading", { name: reps[1].name })).toBeTruthy();
    expect(screen.getByText("Set 2 of 3")).toBeTruthy();
    expect(screen.getByText("Full · 2 of 3")).toBeTruthy();
  });

  it("timed item counts down and moves to rest at 0", () => {
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 2, set: 0 }} />);
    expect(screen.getByText("0:30")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("0:25")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(25000);
    });
    expect(screen.getByText("Rest")).toBeTruthy();
    expect(saveSet).toHaveBeenCalledWith(plan.date, 2, "done");
  });

  it("shows the placeholder when frames are null", () => {
    lib.nullFrames = true;
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 0, set: 0 }} />);
    const img = screen.getAllByRole("img")[0] as HTMLImageElement;
    expect(img.getAttribute("src")).toMatch(/placeholder\.svg$/);
  });

  it("calls saveSetAction on Done set", () => {
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 0, set: 0 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Done set" }));
    expect(saveSet).toHaveBeenCalledWith(plan.date, 0, "done");
    expect(screen.getByText("Rest")).toBeTruthy();
    expect(screen.getAllByText(/Up next/).length).toBeGreaterThan(0);
  });

  it("retries a failed save once", async () => {
    saveSet.mockRejectedValueOnce(new Error("offline"));
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 0, set: 0 }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Done set" }));
    });
    expect(saveSet).toHaveBeenCalledTimes(2);
  });

  it("finishes with feels from the summary", async () => {
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 3, set: 0 }} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Hard" })[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));
    });
    expect(finish).toHaveBeenCalledWith(plan.date, { [reps[0].id]: "hard" });
  });

  it("keeps saves in order when an earlier one fails and is retried", async () => {
    let failFirst: (e: Error) => void = () => {};
    saveSet
      .mockImplementationOnce(() => new Promise((_, reject) => (failFirst = reject)))
      .mockResolvedValue({});
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 0, set: 0 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Done set" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip rest" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(saveSet).toHaveBeenCalledTimes(1);
    await act(async () => {
      failFirst(new Error("offline"));
    });
    expect(saveSet.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      [0, "done"],
      [0, "done"],
      [0, "skip"],
    ]);
  });

  it("shows the skipped notice, with no rating, when every exercise was skipped", () => {
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 3, set: 0, items: plan.items.map(() => ({ setsDone: 0, skipped: true })) }} />);
    expect(screen.getByText("Workout skipped — it doesn't count toward your streak.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Finish workout" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Easy" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to Exercise" }).getAttribute("href")).toBe("/exercise");
  });

  it("offers Skip when the exercise is missing from the library", () => {
    const broken: PlanDay = { ...plan, items: [{ exerciseId: "gone", sets: 2, reps: 8, restSec: 20 }, plan.items[1]] };
    render(<WorkoutPlayer date={plan.date} plan={broken} start={{ item: 0, set: 0 }} />);
    expect(screen.getByText("This exercise is no longer available.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(saveSet).toHaveBeenCalledWith(plan.date, 0, "skip");
    expect(screen.getByRole("heading", { name: reps[1].name })).toBeTruthy();
  });

  it("announces phase changes politely and moves focus to the main action", () => {
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 0, set: 0 }} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe(`${reps[0].name}, set 1 of 3`);
    fireEvent.click(screen.getByRole("button", { name: "Done set" }));
    expect(screen.getByRole("status").textContent).toMatch(/^Rest\. Up next: /);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Skip rest" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip rest" }));
    expect(screen.getByRole("status").textContent).toBe(`${reps[0].name}, set 2 of 3`);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Done set" }));
  });

  it("requests the wake lock again when the tab becomes visible", async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release, released: false }));
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    render(<WorkoutPlayer date={plan.date} plan={plan} start={{ item: 0, set: 0 }} />);
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);
    // The browser drops the lock while hidden.
    const sentinel = await request.mock.results[0].value;
    sentinel.released = true;
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(request).toHaveBeenCalledTimes(2);
    Reflect.deleteProperty(navigator, "wakeLock");
  });

  it("renders summary rows by position even if an exercise repeats", () => {
    const dup: PlanDay = { ...plan, items: [plan.items[0], { ...plan.items[0] }] };
    render(<WorkoutPlayer date={plan.date} plan={dup} start={{ item: 2, set: 0, items: [{ setsDone: 3, skipped: false }, { setsDone: 3, skipped: false }] }} />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });
});
