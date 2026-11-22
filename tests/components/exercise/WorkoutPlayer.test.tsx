import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText(/Up next/)).toBeTruthy();
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
});
