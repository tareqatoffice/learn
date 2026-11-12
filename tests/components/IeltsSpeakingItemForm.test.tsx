// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const a = vi.hoisted(() => ({
  createItemAction: vi.fn(async () => ({ ok: true as const, id: "64b000000000000000000009" })),
  updateItemAction: vi.fn(async () => ({ ok: true as const })),
  deleteItemAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/app/(app)/admin/ielts/speaking/actions", () => a);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { IeltsSpeakingItemForm } from "@/components/admin/IeltsSpeakingItemForm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IeltsSpeakingItemForm", () => {
  it("shows the cue card fields only for part2", () => {
    const { rerender } = render(<IeltsSpeakingItemForm type="part1" cards={[]} />);
    expect(screen.queryByLabelText(/bullets/i)).toBeNull();
    expect(screen.getByLabelText(/questions/i)).toBeTruthy();
    rerender(<IeltsSpeakingItemForm type="part3" cards={[]} />);
    expect(screen.queryByLabelText(/bullets/i)).toBeNull();
    rerender(<IeltsSpeakingItemForm type="part2" cards={[]} />);
    expect(screen.getByLabelText(/bullets/i)).toBeTruthy();
    expect(screen.queryByLabelText(/questions/i)).toBeNull();
  });

  it("offers the part2 cards for a part3 set", () => {
    render(<IeltsSpeakingItemForm type="part3" cards={[{ id: "c1", title: "A teacher" }]} />);
    expect(screen.getByRole("option", { name: "A teacher" })).toBeTruthy();
  });

  it("creates a part1 item from one question per line", async () => {
    const user = userEvent.setup();
    render(<IeltsSpeakingItemForm type="part1" cards={[]} />);
    await user.type(screen.getByLabelText("Title"), "Hometown");
    await user.type(screen.getByLabelText(/questions/i), "Where are you from?{Enter}Do you like it?{Enter}{Enter}What changed?");
    await user.click(screen.getByRole("button", { name: "Create item" }));
    expect(a.createItemAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "part1", title: "Hometown", questions: ["Where are you from?", "Do you like it?", "What changed?"] }),
    );
  });

  it("saves an existing part2 item with its cue fields", async () => {
    const user = userEvent.setup();
    render(
      <IeltsSpeakingItemForm
        type="part2"
        cards={[]}
        item={{
          id: "64b000000000000000000001",
          type: "part2",
          title: "A teacher",
          aboutYou: false,
          questions: [],
          cue: { topic: "Describe a teacher", bullets: ["who", "what", "when"], explain: "and why", roundOff: [] },
          cardId: "",
          status: "draft",
          tags: [],
          generated: false,
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save item" }));
    expect(a.updateItemAction).toHaveBeenCalledWith(
      "64b000000000000000000001",
      expect.objectContaining({ type: "part2", topic: "Describe a teacher", bullets: ["who", "what", "when"], explain: "and why", roundOff: [] }),
    );
  });
});
