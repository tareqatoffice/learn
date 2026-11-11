// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelfBandsForm } from "@/components/ielts/SelfBandsForm";

const actions = vi.hoisted(() => ({
  saveSelfBandsAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const, band: 6.5 })),
}));
vi.mock("@/app/(app)/ielts/speaking/actions", () => actions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const id = "64b000000000000000000001";

describe("SelfBandsForm", () => {
  it("offers only whole bands 1-9 for each criterion", () => {
    render(<SelfBandsForm attemptId={id} video={false} onSaved={vi.fn()} />);
    for (const name of [/fluency/i, /lexical/i, /grammatical/i, /pronunciation/i]) {
      const select = screen.getByRole("combobox", { name });
      const values = within(select)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value)
        .filter(Boolean);
      expect(values).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    }
  });

  it("shows body-language scores only for video", () => {
    const { unmount } = render(<SelfBandsForm attemptId={id} video={false} onSaved={vi.fn()} />);
    expect(screen.queryByRole("combobox", { name: /eye contact/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /gestures/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /confidence/i })).toBeNull();
    unmount();
    render(<SelfBandsForm attemptId={id} video onSaved={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: /eye contact/i })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /gestures/i })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /confidence/i })).toBeTruthy();
  });

  it("asks for every band before saving", async () => {
    const user = userEvent.setup();
    render(<SelfBandsForm attemptId={id} video={false} onSaved={vi.fn()} />);
    await user.selectOptions(screen.getByRole("combobox", { name: /fluency/i }), "6");
    await user.click(screen.getByRole("button", { name: /save my bands/i }));
    expect(screen.getByRole("alert").textContent).toMatch(/choose a band for lexical resource/i);
    expect(actions.saveSelfBandsAction).not.toHaveBeenCalled();
  });

  it("saves the four bands and reports the computed band", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<SelfBandsForm attemptId={id} video={false} onSaved={onSaved} />);
    await user.selectOptions(screen.getByRole("combobox", { name: /fluency/i }), "6");
    await user.selectOptions(screen.getByRole("combobox", { name: /lexical/i }), "7");
    await user.selectOptions(screen.getByRole("combobox", { name: /grammatical/i }), "6");
    await user.selectOptions(screen.getByRole("combobox", { name: /pronunciation/i }), "6");
    await user.click(screen.getByRole("button", { name: /save my bands/i }));
    expect(actions.saveSelfBandsAction).toHaveBeenCalledWith(id, { fluency: 6, lexical: 7, grammar: 6, pronunciation: 6 });
    expect(onSaved).toHaveBeenCalledWith({ fluency: 6, lexical: 7, grammar: 6, pronunciation: 6 });
    expect(await screen.findByText(/speaking band 6\.5/i)).toBeTruthy();
  });
});
