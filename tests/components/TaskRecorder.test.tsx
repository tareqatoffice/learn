// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskRecorder } from "@/components/speaking/TaskRecorder";
import type { RecorderResult, RecorderState } from "@/lib/useRecorder";


const recorder = vi.hoisted(() => ({
  value: {
    state: "idle" as RecorderState,
    error: "",
    elapsedSec: 0,
    stream: null,
    result: null as RecorderResult | null,
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    reset: vi.fn(),
  },
}));
vi.mock("@/lib/useRecorder", () => ({ useRecorder: () => recorder.value }));

const upload = vi.hoisted(() => {
  class UploadError extends Error {}
  return { UploadError, uploadTake: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}) };
});
vi.mock("@/lib/uploadTake", () => upload);

const actions = vi.hoisted(() => ({
  startTakeAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({
    ok: true as const,
    takeId: "64b000000000000000000009",
    uploadUrl: "https://r2.test/put",
    maxBytes: 1_000_000,
    capSec: 600,
  })),
  confirmTakeAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const })),
  transcribeTakeAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const, transcript: "hi" })),
  deleteTakeAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const })),
  generateMaterialAction: vi.fn(),
}));
vi.mock("@/app/(app)/speaking/actions", () => actions);

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const confirmMock = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/components/ConfirmDialog", () => ({
  confirm: (...args: unknown[]) => confirmMock(...args),
  ConfirmHost: () => null,
}));

const base = {
  date: "2026-11-10",
  lessonId: "64b000000000000000000003",
  videoDefault: false,
  storage: true,
};

beforeEach(() => {
  recorder.value = { ...recorder.value, state: "idle", result: null, error: "", elapsedSec: 0 };
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  confirmMock.mockResolvedValue(true);
});

describe("TaskRecorder", () => {
  it("TaskRecorder keeps Start disabled until headphones are confirmed for shadowing", async () => {
    const user = userEvent.setup();
    render(
      <TaskRecorder
        {...base}
        task="shadowing"
        material={{ title: "Lesson 1", text: "Hello there.", generated: false }}
        sourceAudioUrl="https://example.test/clip.mp3"
        clipSec={30}
      />,
    );
    const start = screen.getByRole("button", { name: /start/i }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: /i'm wearing headphones/i }));
    expect(start.disabled).toBe(false);
    await user.click(start);
    expect(recorder.value.start).toHaveBeenCalled();
  });

  it("does not ask about headphones for read aloud", () => {
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    expect(screen.queryByRole("checkbox", { name: /headphones/i })).toBeNull();
    expect((screen.getByRole("button", { name: /start/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("allows a free practice take with no material, and hides Generate with AI when the coach is off (F8)", () => {
    render(<TaskRecorder {...base} lessonId={null} task="recordReview" material={null} aiOn={false} hasLesson={false} />);
    expect(screen.getByText(/No speaking lessons are published yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate with AI" })).toBeNull();
    expect((screen.getByRole("button", { name: /start/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("offers Generate with AI when the coach is on (F8)", () => {
    render(<TaskRecorder {...base} task="readAloud" material={null} />);
    expect(screen.getByText(/Today's lesson has nothing for this task/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate with AI" })).toBeTruthy();
  });

  it("asks before an in-app link leaves an unsaved recording (U6)", async () => {
    recorder.value = { ...recorder.value, state: "recording" };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    const link = document.createElement("a");
    link.href = "/dashboard";
    link.textContent = "Dashboard";
    document.body.appendChild(link);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);
    expect(confirm).toHaveBeenCalledWith("Your recording hasn't been saved. Leave anyway?");
    expect(event.defaultPrevented).toBe(true);
    link.remove();
    confirm.mockRestore();
  });

  it("asks before saving a very short take, and saves it only when kept (U16)", async () => {
    const user = userEvent.setup();
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      elapsedSec: 1,
      result: { blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", durationSec: 1 },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    expect(await screen.findByText(/only 0:01 long/)).toBeTruthy();
    expect(actions.startTakeAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save it" }));
    await waitFor(() => expect(actions.startTakeAction).toHaveBeenCalled());
  });

  it("can cancel an upload in progress and keeps the recording for a retry (U16)", async () => {
    const user = userEvent.setup();
    upload.uploadTake.mockImplementationOnce(
      (_url: unknown, _blob: unknown, _mime: unknown, opts: unknown) =>
        new Promise<void>((_resolve, reject) => {
          const o = opts as { signal: AbortSignal; onProgress: (f: number) => void };
          o.onProgress(0.4);
          o.signal.addEventListener("abort", () => reject(new upload.UploadError("The upload was cancelled.")));
        }),
    );
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      elapsedSec: 42,
      result: { blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", durationSec: 42 },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    expect(await screen.findByText(/40%/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel upload" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/cancelled/);
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("TaskRecorder shows retry after a failed upload", async () => {
    const user = userEvent.setup();
    upload.uploadTake.mockRejectedValueOnce(new upload.UploadError("The upload failed (500). Try again."));
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      elapsedSec: 42,
      result: { blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", durationSec: 42 },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);

    const retry = await screen.findByRole("button", { name: /try again/i });
    expect(screen.getByRole("alert").textContent).toMatch(/upload failed/i);
    expect(actions.confirmTakeAction).not.toHaveBeenCalled();
    expect(actions.startTakeAction).toHaveBeenCalledWith(
      expect.objectContaining({ task: "readAloud", kind: "audio", mime: "audio/webm", date: base.date, size: 1 }),
    );
    expect(upload.uploadTake).toHaveBeenCalledWith("https://r2.test/put", expect.any(Blob), "audio/webm", expect.objectContaining({ signal: expect.any(AbortSignal) }));

    await user.click(retry);
    await waitFor(() => expect(actions.confirmTakeAction).toHaveBeenCalledWith("64b000000000000000000009", 42));
    // The retry reuses the take it already started.
    expect(actions.startTakeAction).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/speaking/takes/64b000000000000000000009");
    // The review page starts transcription; the recorder only navigates.
    expect(actions.transcribeTakeAction).not.toHaveBeenCalled();
  });

  it("deletes the expired take and starts a new one when a retry comes after the upload URLs lapse", async () => {
    const user = userEvent.setup();
    const t0 = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(t0);
    upload.uploadTake.mockRejectedValueOnce(new upload.UploadError("The upload failed (500). Try again."));
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      result: { blob: new Blob(["x"]), mime: "audio/webm", durationSec: 5 },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    const retry = await screen.findByRole("button", { name: /try again/i });

    now.mockReturnValue(t0 + 9 * 60 * 1000);
    actions.startTakeAction.mockResolvedValueOnce({
      ok: true as const,
      takeId: "64b00000000000000000000a",
      uploadUrl: "https://r2.test/put2",
      maxBytes: 1_000_000,
      capSec: 600,
    });
    await user.click(retry);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/speaking/takes/64b00000000000000000000a"));
    expect(actions.deleteTakeAction).toHaveBeenCalledWith("64b000000000000000000009");
    expect(actions.startTakeAction).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it("sends both blob sizes for a video take", async () => {
    upload.uploadTake.mockRejectedValueOnce(new upload.UploadError("The upload failed (500). Try again."));
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      result: {
        blob: new Blob(["video!"], { type: "video/webm" }),
        mime: "video/webm",
        audioBlob: new Blob(["aud"], { type: "audio/webm" }),
        audioMime: "audio/webm",
        durationSec: 5,
      },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    await screen.findByRole("button", { name: /try again/i });
    expect(actions.startTakeAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "video", mime: "video/webm", audioMime: "audio/webm", size: 6, audioSize: 3 }),
    );
  });

  it("Discard deletes the take it started", async () => {
    const user = userEvent.setup();
    confirmMock.mockResolvedValue(true);
    upload.uploadTake.mockRejectedValueOnce(new upload.UploadError("The upload failed (500). Try again."));
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      result: { blob: new Blob(["x"]), mime: "audio/webm", durationSec: 5 },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    await user.click(await screen.findByRole("button", { name: /discard/i }));
    expect(actions.deleteTakeAction).toHaveBeenCalledWith("64b000000000000000000009");
    expect(recorder.value.reset).toHaveBeenCalled();
  });

  it("Discard with no started take deletes nothing", async () => {
    const user = userEvent.setup();
    confirmMock.mockResolvedValue(true);
    actions.startTakeAction.mockResolvedValueOnce({ ok: false, errors: { _: "Invalid recording size." } } as never);
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      result: { blob: new Blob(["x"]), mime: "audio/webm", durationSec: 5 },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    await user.click(await screen.findByRole("button", { name: /discard/i }));
    expect(actions.deleteTakeAction).not.toHaveBeenCalled();
  });

  it("refuses a recording bigger than the take's byte limit from startTake", async () => {
    actions.startTakeAction.mockResolvedValueOnce({
      ok: true as const,
      takeId: "64b000000000000000000009",
      uploadUrl: "https://r2.test/put",
      maxBytes: 2,
      capSec: 600,
    });
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      result: { blob: new Blob(["too big"]), mime: "audio/webm", durationSec: 5 },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/larger than/i);
    expect(upload.uploadTake).not.toHaveBeenCalled();
  });

  it("drops the take and asks to start again when the clip won't play", async () => {
    recorder.value = { ...recorder.value, state: "recording" };
    vi.mocked(window.HTMLMediaElement.prototype.play).mockImplementation(() => Promise.reject(new Error("NotAllowed")));
    render(
      <TaskRecorder
        {...base}
        task="shadowing"
        material={{ title: "Lesson 1", text: "Hello there.", generated: false }}
        sourceAudioUrl="https://example.test/clip.mp3"
        clipSec={30}
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toBe("The clip didn't start. Tap Start again.");
    expect(recorder.value.reset).toHaveBeenCalled();
  });

  it("surfaces a startTake failure message", async () => {
    actions.startTakeAction.mockResolvedValueOnce({ ok: false, errors: { _: "That date isn't today." } } as never);
    recorder.value = {
      ...recorder.value,
      state: "stopped",
      result: { blob: new Blob(["x"]), mime: "audio/webm", durationSec: 5 },
    };
    render(<TaskRecorder {...base} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    expect((await screen.findByRole("alert")).textContent).toBe("That date isn't today.");
  });

  it("explains when storage isn't set up", () => {
    render(<TaskRecorder {...base} storage={false} task="readAloud" material={{ title: "P", text: "Read me.", generated: false }} />);
    expect(screen.getByText(/recording storage isn't set up yet/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /start/i })).toBeNull();
  });
});
