// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelfRatingForm } from "@/components/speaking/SelfRatingForm";

const { saveSelfRatingAction } = vi.hoisted(() => ({
  saveSelfRatingAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const })),
}));
vi.mock("@/app/(app)/speaking/actions", () => ({ saveSelfRatingAction }));

afterEach(() => {
  cleanup();
  saveSelfRatingAction.mockClear();
});

const props = { takeId: "64b000000000000000000002", durationSec: 60, currentTime: () => 12.4, onSaved: vi.fn() };

describe("SelfRatingForm", () => {
  it("SelfRatingForm hides eye contact and gestures for audio takes", () => {
    render(<SelfRatingForm {...props} kind="audio" />);
    expect(screen.getByRole("radiogroup", { name: /fluency/i })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: /confidence/i })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: /eye contact/i })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: /gestures/i })).toBeNull();
  });

  it("shows eye contact and gestures for video takes", () => {
    render(<SelfRatingForm {...props} kind="video" />);
    expect(screen.getByRole("radiogroup", { name: /eye contact/i })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: /gestures/i })).toBeTruthy();
  });

  it("SelfRatingForm requires fluency", async () => {
    const user = userEvent.setup();
    render(<SelfRatingForm {...props} kind="audio" />);
    await user.click(screen.getByRole("button", { name: /save rating/i }));
    expect(screen.getByRole("alert").textContent).toBe("Rate your fluency first");
    expect(saveSelfRatingAction).not.toHaveBeenCalled();
  });

  it("saves the ratings with a marker at the player's time", async () => {
    const user = userEvent.setup();
    render(<SelfRatingForm {...props} kind="audio" />);
    await user.click(screen.getByRole("radio", { name: "Fluency 4" }));
    await user.click(screen.getByRole("radio", { name: "Confidence 3" }));
    await user.click(screen.getByRole("button", { name: /mark this moment/i }));
    await user.type(screen.getByRole("textbox", { name: /label for the moment at 0:12/i }), "filler words");
    await user.click(screen.getByRole("button", { name: /save rating/i }));
    expect(saveSelfRatingAction).toHaveBeenCalledWith(props.takeId, {
      fluency: 4,
      confidence: 3,
      note: "",
      markers: [{ atSec: 12.4, label: "filler words" }],
    });
    expect(props.onSaved).toHaveBeenCalled();
  });
});
