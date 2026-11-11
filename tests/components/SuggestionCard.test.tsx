// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuggestionCard } from "@/components/ielts/SuggestionCard";
import type { PlanView } from "@/ielts/profile";

const { approveSuggestionAction, dismissSuggestionAction } = vi.hoisted(() => ({
  approveSuggestionAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const, version: 2 })),
  dismissSuggestionAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const })),
}));
vi.mock("@/app/(app)/ielts/actions", () => ({ approveSuggestionAction, dismissSuggestionAction }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const plan = (version: number, speaking: number): PlanView => ({
  version,
  reason: "r",
  createdAt: "2026-11-01T00:00:00.000Z",
  phases: [{ name: "skills", start: "2026-11-12", end: "2027-01-01" }],
  weeks: [{ start: "2026-11-12", end: "2026-11-18", minutes: { listening: 100, reading: 100, writing: 100, speaking }, mocks: 1 }],
  hours: { needed: 200, available: 150, short: true },
  adjustments: [],
});
const suggestion = {
  id: "s1",
  kind: "missed" as const,
  reason: "You did 40% of last week's target.",
  preview: { before: plan(1, 100), after: plan(2, 140), dropped: [] },
};

describe("SuggestionCard", () => {
  it("changes nothing until a button is clicked", () => {
    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText(/40% of last week/)).toBeTruthy();
    expect(approveSuggestionAction).not.toHaveBeenCalled();
    expect(dismissSuggestionAction).not.toHaveBeenCalled();
  });

  it("shows a before and after preview on request", async () => {
    const user = userEvent.setup();
    render(<SuggestionCard suggestion={suggestion} />);
    await user.click(screen.getByRole("button", { name: /see preview/i }));
    expect(screen.getByText(/^Before/)).toBeTruthy();
    expect(screen.getByText(/^After/)).toBeTruthy();
  });

  it("approve calls the approve action with the id", async () => {
    const user = userEvent.setup();
    render(<SuggestionCard suggestion={suggestion} />);
    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(approveSuggestionAction).toHaveBeenCalledWith("s1");
    expect(dismissSuggestionAction).not.toHaveBeenCalled();
  });

  it("dismiss calls the dismiss action with the id", async () => {
    const user = userEvent.setup();
    render(<SuggestionCard suggestion={suggestion} />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(dismissSuggestionAction).toHaveBeenCalledWith("s1");
    expect(approveSuggestionAction).not.toHaveBeenCalled();
  });
});
