import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DoneWorkoutSummary } from "@/features/exercise/components/DoneWorkoutSummary";
import type { PlanDay } from "@/features/exercise/plan";

const { finishSessionAction } = vi.hoisted(() => ({
  finishSessionAction: vi.fn<(date: string, feels: Record<string, string>) => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("@/app/(app)/exercise/actions", () => ({ finishSessionAction }));

afterEach(() => {
  cleanup();
  finishSessionAction.mockClear();
});

const item = (exerciseId: string) => ({ exerciseId, sets: 3, reps: 10 }) as PlanDay["items"][number];
const plan = { date: "2026-11-22", focus: "full", minutes: 20, items: [item("squat"), item("pushup")] } as PlanDay;

describe("DoneWorkoutSummary", () => {
  it("lets a done workout without feels be rated and finished", async () => {
    const user = userEvent.setup();
    render(<DoneWorkoutSummary exercises={{}} date="2026-11-22" today="2026-11-22" plan={plan} initialFeels={{}} skipped={[]} />);
    const easy = screen.getAllByRole("button", { name: "Easy" });
    await user.click(easy[0]);
    await user.click(screen.getByRole("button", { name: "Finish workout" }));
    expect(finishSessionAction).toHaveBeenCalledWith("2026-11-22", { squat: "easy" });
    expect(screen.queryByRole("button", { name: "Finish workout" })).toBeNull();
  });

  it("is read-only once feels exist", () => {
    render(<DoneWorkoutSummary exercises={{}} date="2026-11-22" today="2026-11-22" plan={plan} initialFeels={{ squat: "hard" }} skipped={[]} />);
    expect(screen.queryByRole("button", { name: "Finish workout" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: "Easy" })).toHaveLength(0);
    expect(screen.getByText("Hard")).toBeTruthy();
  });

  it("shows skipped exercises as skipped with no feel buttons", () => {
    render(<DoneWorkoutSummary exercises={{}} date="2026-11-22" today="2026-11-22" plan={plan} initialFeels={{}} skipped={["pushup"]} />);
    expect(screen.getByText("Skipped")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Easy" })).toHaveLength(1);
  });

  it("is read-only on a past day even without feels", () => {
    render(<DoneWorkoutSummary exercises={{}} date="2026-11-22" today="2026-11-23" plan={plan} initialFeels={{}} skipped={[]} />);
    expect(screen.queryByRole("button", { name: "Finish workout" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: "Easy" })).toHaveLength(0);
    expect(screen.getAllByText("Not rated")).toHaveLength(2);
  });
});
