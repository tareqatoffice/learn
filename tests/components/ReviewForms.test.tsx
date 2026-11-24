import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanForm, ReviewForm } from "@/features/focus/components/ReviewForms";

const { saveWeeklyReviewAction, saveFocusPlanAction } = vi.hoisted(() => ({
  saveWeeklyReviewAction: vi.fn<(weekStart: string, answers: unknown) => Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>>(
    () => Promise.resolve({ ok: true }),
  ),
  saveFocusPlanAction: vi.fn<(plan: unknown) => Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>>(() =>
    Promise.resolve({ ok: true }),
  ),
}));
vi.mock("@/app/(app)/focus-actions", () => ({ saveWeeklyReviewAction, saveFocusPlanAction }));
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  refresh.mockClear();
  saveWeeklyReviewAction.mockClear();
  saveFocusPlanAction.mockClear();
});

describe("ReviewForm", () => {
  it("saves the three answers for the week", async () => {
    const user = userEvent.setup();
    render(<ReviewForm weekStart="2026-11-23" initial={null} />);
    await user.type(screen.getByLabelText("What helped me focus most this week?"), "Phone away");
    await user.type(screen.getByLabelText(/What pulled me away most often/), "Messages");
    await user.type(screen.getByLabelText("What one change will I make next week?"), "Mute them");
    await user.click(screen.getByRole("button", { name: "Save review" }));

    expect(saveWeeklyReviewAction).toHaveBeenCalledWith("2026-11-23", { helped: "Phone away", pulledAway: "Messages", change: "Mute them" });
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("shows earlier answers and reports a server error", async () => {
    const user = userEvent.setup();
    saveWeeklyReviewAction.mockResolvedValueOnce({ ok: false, errors: { _: "You can only review this week or last week." } });
    render(<ReviewForm weekStart="2026-11-23" initial={{ helped: "Before", pulledAway: "", change: "" }} />);
    expect((screen.getByLabelText("What helped me focus most this week?") as HTMLTextAreaElement).value).toBe("Before");

    await user.click(screen.getByRole("button", { name: "Save review" }));
    expect(screen.getByRole("alert").textContent).toMatch(/only review this week or last week/);
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("reports a failed request and clears the status on edit", async () => {
    const user = userEvent.setup();
    saveWeeklyReviewAction.mockRejectedValueOnce(new Error("down"));
    render(<ReviewForm weekStart="2026-11-23" initial={null} />);
    await user.click(screen.getByRole("button", { name: "Save review" }));
    expect(screen.getByRole("alert").textContent).toMatch(/could not save/i);

    await user.type(screen.getByLabelText("What helped me focus most this week?"), "x");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("PlanForm", () => {
  it("starts from the suggested block and saves the plan", async () => {
    const user = userEvent.setup();
    render(<PlanForm initial={null} suggestedMinutes={30} />);
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("30");

    fireEvent.change(screen.getByLabelText("If it is"), { target: { value: "07:15" } });
    await user.click(screen.getByRole("button", { name: "Save plan" }));

    expect(saveFocusPlanAction).toHaveBeenCalledWith({
      time: "07:15",
      action: "sit at my desk with my phone in another room and focus",
      minutes: 30,
      enabled: true,
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the saved plan, can turn reminders off, and reports errors", async () => {
    const user = userEvent.setup();
    saveFocusPlanAction.mockResolvedValueOnce({ ok: false, errors: { _: "That plan isn't valid." } });
    render(<PlanForm initial={{ time: "20:00", action: "read chapter 2", minutes: 40, enabled: true }} suggestedMinutes={25} />);
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("40");

    await user.click(screen.getByRole("checkbox", { name: "Remind me in the app at that time" }));
    await user.click(screen.getByRole("button", { name: "Save plan" }));

    expect(saveFocusPlanAction).toHaveBeenCalledWith({ time: "20:00", action: "read chapter 2", minutes: 40, enabled: false });
    expect(screen.getByRole("alert").textContent).toMatch(/isn't valid/);
    expect(refresh).not.toHaveBeenCalled();
  });
});
