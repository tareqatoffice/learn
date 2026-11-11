// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "@/components/ielts/ProfileForm";
import type { PlanView } from "@/ielts/profile";

const { previewProfileAction, saveProfileAction } = vi.hoisted(() => ({
  previewProfileAction: vi.fn<(...args: unknown[]) => Promise<object>>(),
  saveProfileAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const, version: 2 })),
}));
vi.mock("@/app/(app)/ielts/actions", () => ({ previewProfileAction, saveProfileAction }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const plan = (version: number): PlanView => ({
  version,
  reason: "r",
  createdAt: "2026-11-01T00:00:00.000Z",
  phases: [{ name: "skills", start: "2026-11-12", end: "2027-01-01" }],
  weeks: [{ start: "2026-11-12", end: "2026-11-18", minutes: { listening: 100, reading: 100, writing: 100, speaking: 100 }, mocks: 1 }],
  hours: { needed: 200, available: 300, short: false },
  adjustments: [],
});

describe("ProfileForm", () => {
  it("previews before saving, listing dropped adjustments", async () => {
    previewProfileAction.mockResolvedValue({
      ok: true,
      before: plan(1),
      after: plan(2),
      dropped: [{ id: "a1", kind: "shiftCriterion", criterion: "fluency", share: 0.15, createdAt: new Date() }],
    });
    const user = userEvent.setup();
    render(<ProfileForm today="2026-11-12" />);
    await user.type(screen.getByLabelText(/test date/i), "2027-02-20");
    await user.selectOptions(screen.getByLabelText(/target band/i), "7");
    await user.selectOptions(screen.getByLabelText(/current band/i), "6");

    // Nothing is saved yet.
    expect(screen.queryByRole("button", { name: /save plan/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /preview plan/i }));

    expect(previewProfileAction).toHaveBeenCalledTimes(1);
    expect(saveProfileAction).not.toHaveBeenCalled();
    expect(screen.getByText(/^Before/)).toBeTruthy();
    expect(screen.getByText(/^After/)).toBeTruthy();
    expect(screen.getByText(/these changes are dropped/i)).toBeTruthy();
    expect(screen.getByText(/Fluency and Coherence/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /save plan/i }));
    expect(saveProfileAction).toHaveBeenCalledTimes(1);
    expect(saveProfileAction.mock.calls[0][0]).toMatchObject({ testDate: "2027-02-20", target: { overall: 7 }, current: { overall: 6 } });
  });

  it("asks for a target band before previewing", async () => {
    const user = userEvent.setup();
    render(<ProfileForm today="2026-11-12" />);
    await user.click(screen.getByRole("button", { name: /preview plan/i }));
    expect(screen.getByText("Pick a target band.")).toBeTruthy();
    expect(previewProfileAction).not.toHaveBeenCalled();
  });

  it("shows field errors from the preview and does not offer saving", async () => {
    previewProfileAction.mockResolvedValue({ ok: false, errors: { testDate: "Pick a test date after today." } });
    const user = userEvent.setup();
    render(<ProfileForm today="2026-11-12" />);
    await user.selectOptions(screen.getByLabelText(/target band/i), "7");
    await user.click(screen.getByRole("button", { name: /preview plan/i }));
    expect(screen.getByText("Pick a test date after today.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /save plan/i })).toBeNull();
  });

  it("drops a stale preview when a field changes", async () => {
    previewProfileAction.mockResolvedValue({ ok: true, before: null, after: plan(1), dropped: [] });
    const user = userEvent.setup();
    render(<ProfileForm today="2026-11-12" />);
    await user.selectOptions(screen.getByLabelText(/target band/i), "7");
    await user.click(screen.getByRole("button", { name: /preview plan/i }));
    expect(screen.getByRole("button", { name: /save plan/i })).toBeTruthy();
    await user.clear(screen.getByLabelText(/minutes per day/i));
    await user.type(screen.getByLabelText(/minutes per day/i), "45");
    expect(screen.queryByRole("button", { name: /save plan/i })).toBeNull();
  });
});
