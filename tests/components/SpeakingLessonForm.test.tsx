// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const a = vi.hoisted(() => ({
  createLessonAction: vi.fn(),
  deleteLessonAction: vi.fn(),
  updateLessonAction: vi.fn(async () => ({ ok: true as const })),
  startLessonAudioUploadAction: vi.fn(async () => ({ ok: true as const, uploadUrl: "https://r2.test/put", key: "lessons/64b000000000000000000001/k.mp3" })),
  confirmLessonAudioAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/app/(app)/admin/speaking/actions", () => a);
vi.mock("@/lib/uploadFile", async (orig) => ({ ...(await orig<typeof import("@/lib/uploadFile")>()), putFile: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { SpeakingLessonForm } from "@/components/admin/SpeakingLessonForm";

const lesson = {
  id: "64b000000000000000000001",
  title: "L",
  order: 1,
  status: "draft" as const,
  subjectIds: [],
  shadowText: "",
  shadowAudioUrl: "",
  shadowAudioKey: "",
  shadowDurationSec: 5,
  passage: "",
  prompt: "",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("SpeakingLessonForm", () => {
  it("keeps the uploaded audio's length so the next save doesn't overwrite it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
    vi.stubGlobal(
      "Audio",
      class {
        duration = 42;
        onloadedmetadata: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onloadedmetadata?.());
        }
      },
    );
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<SpeakingLessonForm lesson={lesson} subjects={[]} storageReady />);
    fireEvent.change(screen.getByLabelText("Upload shadowing audio"), {
      target: { files: [new File(["x"], "a.mp3", { type: "audio/mpeg" })] },
    });
    await waitFor(() => expect(a.confirmLessonAudioAction).toHaveBeenCalledWith(lesson.id, expect.any(String), 42));
    await waitFor(() => expect((screen.getByLabelText(/audio length/i) as HTMLInputElement).value).toBe("42"));
    await userEvent.setup().click(screen.getByRole("button", { name: "Save lesson" }));
    await waitFor(() => expect(a.updateLessonAction).toHaveBeenCalled());
    expect((a.updateLessonAction.mock.calls[0] as unknown[])[1]).toMatchObject({ shadowDurationSec: 42 });
  });

  it("shows a notice when storage isn't configured", () => {
    render(<SpeakingLessonForm lesson={lesson} subjects={[]} storageReady={false} />);
    expect(screen.getByRole("status").textContent).toMatch(/storage isn.t configured/);
  });
});
