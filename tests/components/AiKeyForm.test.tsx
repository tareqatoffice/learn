import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { saveAiKeyAction, clearAiKeyAction, refresh, confirmMock } = vi.hoisted(() => ({
  saveAiKeyAction: vi.fn(),
  clearAiKeyAction: vi.fn(async () => ({ ok: true as const })),
  refresh: vi.fn(),
  confirmMock: vi.fn(async (..._args: unknown[]) => true),
}));
vi.mock("@/app/(app)/admin/ai/actions", () => ({ saveAiKeyAction, clearAiKeyAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/ConfirmDialog", () => ({
  confirm: (...args: unknown[]) => confirmMock(...args),
  ConfirmHost: () => null,
}));

import { AiKeyForm } from "@/features/admin/components/AiKeyForm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  confirmMock.mockResolvedValue(true);
});

describe("AiKeyForm", () => {
  it("says where the key comes from without showing it", () => {
    render(<AiKeyForm source="settings" hint="abcd" updatedAt="5 Nov 2026" unreadable={false} />);
    expect(screen.getByText(/Using the key saved here/).textContent).toContain("…abcd");
    expect((screen.getByLabelText("New OpenRouter API key") as HTMLInputElement).type).toBe("password");
    cleanup();
    render(<AiKeyForm source="env" unreadable={false} />);
    expect(screen.getByText(/from the environment/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove saved key" })).toBeNull();
    cleanup();
    render(<AiKeyForm source="none" unreadable />);
    expect(screen.getByText("No key yet.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/AUTH_SECRET changed/);
  });

  it("saves a key, clears the field and reports verification", async () => {
    saveAiKeyAction.mockResolvedValue({ ok: true, verified: { status: "valid", label: "learn", freeTier: true } });
    render(<AiKeyForm source="none" unreadable={false} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("New OpenRouter API key") as HTMLInputElement;
    await user.type(input, "sk-or-v1-xyz");
    await user.click(screen.getByRole("button", { name: "Save key" }));
    expect(saveAiKeyAction).toHaveBeenCalledWith("sk-or-v1-xyz");
    expect((await screen.findByRole("status")).textContent).toMatch(/verified \(learn\).*free tier/);
    expect(input.value).toBe("");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a rejection and keeps the typed key", async () => {
    saveAiKeyAction.mockResolvedValue({ ok: false, errors: { _: "OpenRouter rejected this key." } });
    render(<AiKeyForm source="env" unreadable={false} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New OpenRouter API key"), "sk-or-bad-key");
    await user.click(screen.getByRole("button", { name: "Save key" }));
    expect((await screen.findByRole("alert")).textContent).toBe("OpenRouter rejected this key.");
    expect((screen.getByLabelText("New OpenRouter API key") as HTMLInputElement).value).toBe("sk-or-bad-key");
  });

  it("asks before removing the saved key, then removes it", async () => {
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<AiKeyForm source="settings" hint="abcd" unreadable={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove saved key" }));
    expect(clearAiKeyAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove saved key" }));
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(clearAiKeyAction).toHaveBeenCalled();
    expect(await screen.findByText("Saved key removed.")).toBeTruthy();
  });
});
