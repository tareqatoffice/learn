// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { saveWritingTextAction, submitWritingAction, refresh } = vi.hoisted(() => ({
  saveWritingTextAction: vi.fn(),
  submitWritingAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/ielts/practice-actions", () => ({ saveWritingTextAction, submitWritingAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { WritingRunner } from "@/components/ielts/WritingRunner";
import type { WritingView } from "@/ielts/writing/attempts";

const view = (): WritingView => ({
  id: "w1",
  date: "2026-11-12",
  kind: "task2",
  status: "in_progress",
  startedAt: new Date().toISOString(),
  selfBand: null,
  aiBand: null,
  tasks: [{ task: "task2", title: "Cities", brief: "Discuss both views.", imageKey: "", imageAlt: "", text: "", wordCount: 0, timeSec: 0 }],
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WritingRunner", () => {
  it("counts words and autosaves the text", async () => {
    saveWritingTextAction.mockResolvedValue({ ok: true });
    render(<WritingRunner view={view()} imageUrls={[]} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "one two three");
    expect(screen.getByText(/3 words · minimum 250/)).toBeTruthy();
    await waitFor(() => expect(saveWritingTextAction).toHaveBeenCalledWith("w1", 0, "one two three", expect.any(Number)), { timeout: 4000 });
  });

  it("retries a failed save instead of leaving the essay only in memory", async () => {
    saveWritingTextAction.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true });
    render(<WritingRunner view={view()} imageUrls={[]} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "draft");
    await waitFor(() => expect(saveWritingTextAction).toHaveBeenCalledTimes(1), { timeout: 4000 });
    await waitFor(() => expect(saveWritingTextAction).toHaveBeenCalledTimes(2), { timeout: 10000 });
    expect(saveWritingTextAction).toHaveBeenLastCalledWith("w1", 0, "draft", expect.any(Number));
  }, 20000);

  it("saves unsent text when the tab is hidden", async () => {
    saveWritingTextAction.mockResolvedValue({ ok: true });
    render(<WritingRunner view={view()} imageUrls={[]} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "x");
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(saveWritingTextAction).toHaveBeenCalledWith("w1", 0, "x", expect.any(Number));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });
});
