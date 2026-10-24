// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkReadButton } from "@/components/NoteReader";

const { setNoteReadAction } = vi.hoisted(() => ({
  setNoteReadAction: vi.fn<(noteId: string, read: boolean) => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("@/app/(app)/notes/actions", () => ({ setNoteReadAction }));

afterEach(() => {
  cleanup();
  setNoteReadAction.mockClear();
});

describe("MarkReadButton", () => {
  it("marks an unread chapter as read and shows the tick", async () => {
    const user = userEvent.setup();
    render(<MarkReadButton noteId="n1" initialRead={false} />);
    await user.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(setNoteReadAction).toHaveBeenCalledWith("n1", true);
    expect(screen.getByRole("button", { name: "Read ✓" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("unmarks a read chapter", async () => {
    const user = userEvent.setup();
    render(<MarkReadButton noteId="n1" initialRead />);
    await user.click(screen.getByRole("button", { name: "Read ✓" }));
    expect(setNoteReadAction).toHaveBeenCalledWith("n1", false);
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeTruthy();
  });

  it("rolls back and reports when saving fails", async () => {
    setNoteReadAction.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<MarkReadButton noteId="n1" initialRead={false} />);
    await user.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/could not save/i);
  });
});
