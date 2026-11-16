// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/Toast", () => ({ toast: vi.fn() }));

import { CommandPalette } from "@/components/CommandPalette";
import { openSearch } from "@/lib/searchBus";

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommandPalette (U4)", () => {
  it("keeps the listbox its input controls in the page, and retries a failed search", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 500 }))
      .mockResolvedValueOnce(Response.json({ hits: [{ kind: "topic", title: "Closures", context: "JS", href: "/graphs/js?topic=c" }] }));
    vi.stubGlobal("fetch", fetch);
    render(<CommandPalette />);
    act(() => openSearch());
    const input = await screen.findByRole("combobox");
    expect(document.getElementById(input.getAttribute("aria-controls")!)).not.toBeNull();
    await userEvent.type(input, "clo");
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("option", { name: /Closures/ })).toBeTruthy());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("option", { name: /Closures/ }).closest("li")?.getAttribute("role")).toBe("presentation");
  });
});
