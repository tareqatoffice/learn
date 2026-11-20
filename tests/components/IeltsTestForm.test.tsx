import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { saveTestAction, refresh, push } = vi.hoisted(() => ({
  saveTestAction: vi.fn(async () => ({ ok: true, id: "t1" })),
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/app/(app)/admin/ielts/tests/actions", () => ({
  saveTestAction,
  deleteTestAction: vi.fn(),
  startSectionAudioUploadAction: vi.fn(),
  confirmSectionAudioAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

import { IeltsTestForm } from "@/features/admin/components/IeltsTestForm";
import type { AdminTest } from "@/features/admin/ieltsTests";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const section = (title: string) => ({ title, passage: "", script: "s", audioKey: "", durationSec: 0, questions: "## completion | w\nQ => a", count: 1 });
const test: AdminTest = { id: "t1", kind: "listening", title: "L", status: "draft", generated: false, sections: [section("One"), section("Two")] };

describe("IeltsTestForm (F7)", () => {
  it("brings the audio uploads back once the test is saved after removing a section", async () => {
    const locked = () => screen.queryAllByText(/Save the test first, then upload/);
    render(<IeltsTestForm kind="listening" test={test} />);
    expect(locked()).toHaveLength(0);
    await userEvent.click(screen.getAllByRole("button", { name: "Remove this section" })[1]);
    expect(locked()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Save test" }));
    await waitFor(() => expect(saveTestAction).toHaveBeenCalled());
    await waitFor(() => expect(locked()).toHaveLength(0));
  });
});
