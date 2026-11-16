// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { countDeckAction, startQuizAction } = vi.hoisted(() => ({
  countDeckAction: vi.fn(async () => 5),
  startQuizAction: vi.fn(async () => ({ empty: true as const })),
}));
vi.mock("@/app/(app)/interview/actions", () => ({ countDeckAction, startQuizAction }));

import { QuizSetup } from "@/components/QuizSetup";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("QuizSetup (F10)", () => {
  it("labels Start with the real deck size", async () => {
    render(<QuizSetup books={[{ id: "b1", title: "JS", parts: [] }]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start · 5 questions" })).toBeTruthy());
    expect(countDeckAction).toHaveBeenLastCalledWith({ bookIds: [], partKeys: [], mode: "unseen", size: 20 });
  });

  it("says so when starting fails (U9)", async () => {
    startQuizAction.mockRejectedValueOnce(new Error("offline"));
    render(<QuizSetup books={[]} />);
    await waitFor(() => expect((screen.getByRole("button", { name: /^Start/ }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: /^Start/ }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Couldn't start the quiz/));
  });

  it("disables Start and says so when nothing matches", async () => {
    countDeckAction.mockResolvedValue(0);
    render(<QuizSetup books={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Review pile" }));
    await waitFor(() => expect((screen.getByRole("button", { name: /^Start/ }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByRole("status").textContent).toMatch(/No questions match/);
  });
});
