// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { saveIeltsSettingsAction, refresh } = vi.hoisted(() => ({ saveIeltsSettingsAction: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(app)/admin/ielts/settings/actions", () => ({ saveIeltsSettingsAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { IeltsSettingsForm } from "@/components/admin/IeltsSettingsForm";
import { DEFAULT_IELTS_SETTINGS } from "@/ielts/settings";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IeltsSettingsForm", () => {
  it("shows the defaults and the hours-per-band helper", () => {
    render(<IeltsSettingsForm initial={DEFAULT_IELTS_SETTINGS} />);
    expect((screen.getByLabelText(/^Hours per band/) as HTMLInputElement).value).toBe("200");
    expect(screen.getByText("rough guide, not an official figure")).toBeTruthy();
    expect((screen.getByLabelText("Foundation %") as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText("Skills %") as HTMLInputElement).value).toBe("45");
    expect((screen.getByLabelText("Mocks %") as HTMLInputElement).value).toBe("25");
    expect((screen.getByLabelText(/^Dismiss for/) as HTMLInputElement).value).toBe("7");
  });

  it("saves the edited values and shows an error for a bad split", async () => {
    saveIeltsSettingsAction.mockResolvedValue({ ok: false, errors: { _: "The split must add up to 100." } });
    const user = userEvent.setup();
    render(<IeltsSettingsForm initial={DEFAULT_IELTS_SETTINGS} />);
    const mocks = screen.getByLabelText("Mocks %");
    await user.clear(mocks);
    await user.type(mocks, "30");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(saveIeltsSettingsAction).toHaveBeenCalledWith({
      hoursPerBand: 200,
      split: { foundation: 30, skills: 45, mocks: 30 },
      thresholds: DEFAULT_IELTS_SETTINGS.thresholds,
    });
    expect(await screen.findByText("The split must add up to 100.")).toBeTruthy();
  });
});
