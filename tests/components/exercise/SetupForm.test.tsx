import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const preview = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/exercise/actions", () => ({
  previewGoalAction: preview,
  saveProfileAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { SetupForm, REPLACES_NOTE } from "@/features/exercise/components/SetupForm";

afterEach(() => {
  cleanup();
  preview.mockReset();
});

const initial = {
  heightCm: 175,
  birthYear: 1990,
  sex: "male" as const,
  level: "beginner" as const,
  workoutDays: [1, 3, 5],
  minutesPerSession: 30,
  startWeightKg: 80,
  goalWeightKg: 60,
  months: 1,
};

describe("SetupForm", () => {
  it("shows the block message and disables save above 1 kg/week", async () => {
    preview.mockResolvedValue({ targetDate: "2026-12-22", pace: -4.6, check: "block", safeTargetDate: "2027-04-22", kcal: 1500 });
    render(<SetupForm initial={initial} />);
    expect(await screen.findByText(/faster than 1 kg a week/i)).toBeTruthy();
    expect(screen.getByText(/2027-04-22/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /save/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables save and shows the target date and calories when the pace is fine", async () => {
    preview.mockResolvedValue({ targetDate: "2027-03-22", pace: -0.3, check: "ok", kcal: 2250 });
    render(<SetupForm initial={{ ...initial, goalWeightKg: 76, months: 4 }} />);
    expect(await screen.findByText(/2,250 kcal/)).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: /save/i }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("renders the medical disclaimer", () => {
    preview.mockResolvedValue(null);
    render(<SetupForm />);
    expect(screen.getByText("This is not medical advice. If you have a health condition or injury, check with a doctor before starting.")).toBeTruthy();
  });

  it("labels the weight field Start weight when editing", async () => {
    preview.mockResolvedValue(null);
    const { unmount } = render(<SetupForm initial={initial} editing />);
    expect(screen.getByLabelText("Start weight (kg)")).toBeTruthy();
    unmount();
    render(<SetupForm initial={initial} />);
    expect(screen.getByLabelText("Current weight (kg)")).toBeTruthy();
  });

  it("warns above Save that a replaced goal starts over", async () => {
    preview.mockResolvedValue({ targetDate: "2027-03-22", pace: -0.3, check: "ok", kcal: 2250, replaces: true });
    render(<SetupForm initial={{ ...initial, goalWeightKg: 76, months: 4 }} editing />);
    expect(await screen.findByText(REPLACES_NOTE)).toBeTruthy();
    expect(REPLACES_NOTE).toBe("Saving starts a new goal. Your logged weights are kept, and your streak starts again.");
  });

  it("shows no replace note when saving keeps the goal", async () => {
    preview.mockResolvedValue({ targetDate: "2027-03-22", pace: -0.3, check: "ok", kcal: 2250, replaces: false });
    render(<SetupForm initial={{ ...initial, goalWeightKg: 76, months: 4 }} editing />);
    await screen.findByText(/2,250 kcal/);
    expect(screen.queryByText(REPLACES_NOTE)).toBeNull();
  });

  it("says a goal beyond 24 months is too far instead of a date", async () => {
    preview.mockResolvedValue({ targetDate: "2026-12-22", pace: -9, check: "block", tooFar: true, kcal: 1500, replaces: false });
    render(<SetupForm initial={initial} />);
    expect(await screen.findByText(/more than 24 months at a safe pace/)).toBeTruthy();
  });
});
