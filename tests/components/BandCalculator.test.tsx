// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BandCalculator } from "@/components/ielts/BandCalculator";

const { saveCalculatorResultAction } = vi.hoisted(() => ({
  saveCalculatorResultAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const, id: "1" })),
}));
vi.mock("@/app/(app)/ielts/actions", () => ({ saveCalculatorResultAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  saveCalculatorResultAction.mockClear();
});

describe("BandCalculator", () => {
  it("converts a raw Listening score of 30 to band 7.0", async () => {
    const user = userEvent.setup();
    render(<BandCalculator today="2026-11-12" />);
    await user.type(screen.getByLabelText(/listening raw/i), "30");
    expect(screen.getByTestId("band-listening").textContent).toBe("7.0");
  });

  it("shows the overall band only once all four skills are filled", async () => {
    const user = userEvent.setup();
    render(<BandCalculator today="2026-11-12" />);
    await user.type(screen.getByLabelText(/listening raw/i), "30");
    await user.type(screen.getByLabelText(/reading raw/i), "30");
    await user.selectOptions(screen.getByLabelText(/writing band/i), "6.5");
    expect(screen.queryByTestId("band-overall")).toBeNull();
    await user.selectOptions(screen.getByLabelText(/speaking band/i), "7");
    expect(screen.getByTestId("band-overall").textContent).toBe("7.0");
  });

  it("saves with the chosen source", async () => {
    const user = userEvent.setup();
    render(<BandCalculator today="2026-11-12" />);
    await user.type(screen.getByLabelText(/listening raw/i), "30");
    await user.click(screen.getByRole("button", { name: /save result/i }));
    expect(saveCalculatorResultAction).toHaveBeenCalledWith({ date: "2026-11-12", source: "practice", listeningRaw: 30 });
  });

  it("locks the source to official when asked", () => {
    render(<BandCalculator today="2026-11-12" source="official" />);
    expect(screen.queryByLabelText(/source/i)).toBeNull();
    expect(screen.getByText(/official result/i)).toBeTruthy();
  });
});
