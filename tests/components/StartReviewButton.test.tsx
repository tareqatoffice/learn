// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartReviewButton } from "@/components/StartReviewButton";

const { startQuizAction } = vi.hoisted(() => ({
  startQuizAction: vi.fn<(filter: unknown) => Promise<{ empty: true }>>(() => Promise.resolve({ empty: true })),
}));
vi.mock("@/app/(app)/interview/actions", () => ({ startQuizAction }));

afterEach(() => {
  cleanup();
  startQuizAction.mockClear();
});

describe("StartReviewButton", () => {
  it("starts a 20-card review quiz over every book", async () => {
    const user = userEvent.setup();
    render(<StartReviewButton />);
    await user.click(screen.getByRole("button", { name: "Start review quiz" }));
    expect(startQuizAction).toHaveBeenCalledWith({ mode: "review", bookIds: [], partKeys: [], size: 20 });
  });

  it("says so when the review pile turned out empty", async () => {
    const user = userEvent.setup();
    render(<StartReviewButton />);
    await user.click(screen.getByRole("button", { name: "Start review quiz" }));
    expect(screen.getByRole("status").textContent).toMatch(/nothing to review/i);
  });
});
