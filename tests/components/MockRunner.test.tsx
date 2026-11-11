// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockRunner, type MockActions, type MockQuestions } from "@/components/ielts/MockRunner";
import type { RecorderResult, RecorderState } from "@/lib/useRecorder";

// A stateful stand-in for useRecorder: start records, stop (or the cap) yields a result.
const rec = vi.hoisted(() => ({ starts: [] as number[] }));
vi.mock("@/lib/useRecorder", async () => {
  const React = await import("react");
  return {
    useRecorder: ({ kind, capSec }: { kind: "audio" | "video"; capSec: number }) => {
      const [state, setState] = React.useState<RecorderState>("idle");
      const [elapsedSec, setElapsedSec] = React.useState(0);
      const [result, setResult] = React.useState<RecorderResult | null>(null);
      const t = React.useRef<{ at: number; tick?: ReturnType<typeof setInterval>; cap?: ReturnType<typeof setTimeout>; on: boolean }>({
        at: 0,
        on: false,
      });
      const finish = React.useCallback(() => {
        if (!t.current.on) return;
        t.current.on = false;
        clearInterval(t.current.tick);
        clearTimeout(t.current.cap);
        const durationSec = Math.min(capSec, Math.max(1, Math.round((Date.now() - t.current.at) / 1000)));
        setElapsedSec(durationSec);
        const mime = kind === "video" ? "video/webm" : "audio/webm";
        setResult({ blob: new Blob([`take-${capSec}`], { type: mime }), mime, durationSec });
        setState("stopped");
      }, [kind, capSec]);
      const start = React.useCallback(async () => {
        rec.starts.push(capSec);
        t.current.on = true;
        t.current.at = Date.now();
        setResult(null);
        setElapsedSec(0);
        setState("recording");
        t.current.tick = setInterval(() => setElapsedSec(Math.min(capSec, Math.round((Date.now() - t.current.at) / 1000))), 250);
        t.current.cap = setTimeout(finish, capSec * 1000);
      }, [capSec, finish]);
      return { state, error: "", elapsedSec, stream: null, result, start, stop: finish, reset: vi.fn() };
    },
  };
});

const upload = vi.hoisted(() => {
  class UploadError extends Error {}
  return { UploadError, uploadTake: vi.fn<(url: string, blob: Blob, mime: string) => Promise<void>>(async () => {}) };
});
vi.mock("@/lib/uploadTake", () => upload);

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const ID = "64b000000000000000000042";

const questions: MockQuestions = {
  part1: {
    frames: [
      { title: "Home", questions: ["Where do you live?", "Do you like it there?"] },
      { title: "Work", questions: ["What do you do?"] },
    ],
  },
  part2: {
    cue: { topic: "Describe a book you enjoyed", bullets: ["what it was", "when you read it"], explain: "and explain why you enjoyed it", roundOff: [] },
  },
  part3: { questions: ["Why do people read?", "Will printed books disappear?"] },
};

function makeActions() {
  return {
    startPart: vi.fn<MockActions["startPart"]>(async (_id, input) => ({
      ok: true as const,
      uploadUrl: `https://r2.test/${input.part}`,
      maxBytes: 10_000_000,
    })),
    confirmPart: vi.fn<MockActions["confirmPart"]>(async () => ({ ok: true as const })),
    transcribePart: vi.fn<MockActions["transcribePart"]>(async () => ({ ok: true as const, transcript: "hi" })),
    finishAttempt: vi.fn<MockActions["finishAttempt"]>(async () => ({ ok: true as const, status: "complete" as const })),
  };
}
let actions = makeActions();

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const click = (name: RegExp) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
    await vi.advanceTimersByTimeAsync(0);
  });
const recording = () => screen.queryByText(/^recording$/i) !== null;

function renderRunner(kind: "mock" | "part1" | "part2" | "part3" = "mock") {
  return render(<MockRunner attemptId={ID} kind={kind} questions={questions} video={false} examinerVoice actions={actions} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  rec.starts = [];
  actions = makeActions();
  vi.stubGlobal("speechSynthesis", undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  upload.uploadTake.mockReset();
  upload.uploadTake.mockImplementation(async () => {});
});

describe("MockRunner", () => {
  it("Part 2 starts recording when prep ends", async () => {
    renderRunner("mock");
    await click(/^start/i);
    expect(rec.starts).toEqual([420]);
    await click(/end part 1/i);
    // Prep: the cue card and a notes box, nothing recording yet.
    expect(screen.getByText("Describe a book you enjoyed")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /notes/i })).toBeTruthy();
    expect(rec.starts).toEqual([420]);
    await tick(59_000);
    expect(rec.starts).toEqual([420]);
    expect(recording()).toBe(false);
    await tick(1_000);
    expect(rec.starts).toEqual([420, 150]);
    expect(recording()).toBe(true);
  });

  it("auto-stops Part 2 at 120 s", async () => {
    renderRunner("part2");
    await click(/^start/i);
    await tick(60_000);
    expect(recording()).toBe(true);
    await tick(60_000);
    expect(screen.getByText(/keep going/i)).toBeTruthy();
    await tick(59_000);
    expect(actions.startPart).not.toHaveBeenCalled();
    await tick(1_000);
    expect(recording()).toBe(false);
    expect(actions.startPart).toHaveBeenCalledWith(ID, expect.objectContaining({ part: "p2", kind: "audio", mime: "audio/webm" }));
    expect(actions.confirmPart).toHaveBeenCalledWith(ID, "p2", { durationSec: 120, markers: [] });
    await tick(0);
    expect(actions.finishAttempt).toHaveBeenCalledWith(ID, { paused: false });
    expect(push).toHaveBeenCalledWith(`/ielts/speaking/${ID}/review`);
  });

  it("asks the round-off question at 120 s and records the answer in Part 2", async () => {
    const withRoundOff = { ...questions, part2: { cue: { ...questions.part2!.cue, roundOff: ["Do you read often?"] } } };
    render(<MockRunner attemptId={ID} kind="part2" questions={withRoundOff} video={false} examinerVoice actions={actions} />);
    await click(/^start/i);
    await tick(60_000 + 120_000);
    expect(recording()).toBe(true);
    expect(screen.getByText("Do you read often?")).toBeTruthy();
    await tick(10_000);
    await click(/end part 2/i);
    expect(actions.confirmPart).toHaveBeenCalledWith(ID, "p2", { durationSec: 130, markers: [{ atSec: 120, label: "Round-off" }] });
  });

  it("shows move-on notice at 300 s in Part 1 but keeps recording", async () => {
    renderRunner("part1");
    await click(/^start/i);
    await tick(299_000);
    expect(screen.queryByText(/time to move on/i)).toBeNull();
    await tick(1_000);
    expect(screen.getByText(/time to move on/i)).toBeTruthy();
    expect(recording()).toBe(true);
    await tick(60_000);
    expect(recording()).toBe(true);
    expect(actions.startPart).not.toHaveBeenCalled();
  });

  it("Next question marks the time and the speaker reads on", async () => {
    renderRunner("part1");
    await click(/^start/i);
    expect(screen.getByText("Where do you live?")).toBeTruthy();
    await tick(10_000);
    await click(/next question/i);
    expect(screen.getByText("Do you like it there?")).toBeTruthy();
    await tick(5_000);
    await click(/next question/i);
    expect(screen.getByText("What do you do?")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /next question/i })).toBeNull();
    await tick(5_000);
    await click(/end part 1/i);
    expect(actions.confirmPart).toHaveBeenCalledWith(ID, "p1", {
      durationSec: 20,
      markers: [
        { atSec: 0, label: "Q1" },
        { atSec: 10, label: "Q2" },
        { atSec: 15, label: "Q3" },
      ],
    });
    expect(actions.transcribePart).toHaveBeenCalledWith(ID, "p1");
  });

  it("keeps part 1 and retries part 2 after a failed PUT", async () => {
    upload.uploadTake.mockImplementation(async (url) => {
      if (url === "https://r2.test/p2" && upload.uploadTake.mock.calls.filter(([u]) => u === url).length === 1) {
        throw new upload.UploadError("The upload failed (500). Try again.");
      }
    });
    renderRunner("mock");
    await click(/^start/i);
    await click(/end part 1/i);
    expect(actions.confirmPart).toHaveBeenCalledWith(ID, "p1", expect.anything());
    await tick(60_000);
    await tick(120_000);
    // Part 3 runs while Part 2's upload has failed.
    expect(rec.starts).toEqual([420, 150, 420]);
    expect(recording()).toBe(true);
    expect(actions.confirmPart).not.toHaveBeenCalledWith(ID, "p2", expect.anything());
    await click(/end part 3/i);

    expect(screen.getByRole("alert").textContent).toMatch(/upload failed/i);
    expect(actions.finishAttempt).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    await click(/try again/i);
    expect(actions.confirmPart).toHaveBeenCalledWith(ID, "p2", expect.anything());
    // The retry reuses Part 2's upload URL; Part 1 is never sent again.
    expect(actions.startPart.mock.calls.map(([, input]) => input.part)).toEqual(["p1", "p2", "p3"]);
    expect(upload.uploadTake.mock.calls.map(([url]) => url)).toEqual([
      "https://r2.test/p1",
      "https://r2.test/p2",
      "https://r2.test/p3",
      "https://r2.test/p2",
    ]);
    await tick(0);
    expect(actions.finishAttempt).toHaveBeenCalledWith(ID, { paused: false });
    expect(push).toHaveBeenCalledWith(`/ielts/speaking/${ID}/review`);
  });

  it("beforeunload set while a part is unsent", async () => {
    let release = () => {};
    upload.uploadTake.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    const leave = () => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    renderRunner("mock");
    expect(leave()).toBe(false);
    await click(/^start/i);
    await click(/end part 1/i);
    // Part 1 is uploading while Part 2 prep runs.
    expect(leave()).toBe(true);
    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(actions.confirmPart).toHaveBeenCalledWith(ID, "p1", expect.anything());
    // Still preparing Part 2, nothing unsent.
    expect(leave()).toBe(false);
  });

  it("pause stops the part, keeps it, and finishes with paused set", async () => {
    renderRunner("part3");
    await click(/^start/i);
    await tick(30_000);
    await click(/pause/i);
    expect(recording()).toBe(false);
    expect(actions.confirmPart).toHaveBeenCalledWith(ID, "p3", expect.objectContaining({ durationSec: 30 }));
    await click(/finish/i);
    expect(actions.finishAttempt).toHaveBeenCalledWith(ID, { paused: true });
  });
});
