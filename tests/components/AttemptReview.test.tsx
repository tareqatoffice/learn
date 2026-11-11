// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttemptReview } from "@/components/ielts/AttemptReview";
import { BandCompare } from "@/components/ielts/BandCompare";
import type { AttemptView } from "@/ielts/speaking/attempts";

const actions = vi.hoisted(() => ({
  saveSelfBandsAction: vi.fn(async () => ({ ok: true as const, band: 6 })),
  aiEstimateAction: vi.fn(),
  attemptBodyFeedbackAction: vi.fn(),
  transcribePartAction: vi.fn(async () => ({ ok: true as const, transcript: "hello there" })),
  deleteAttemptAction: vi.fn(async () => ({ ok: true as const })),
  setBodyConsentAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/app/(app)/ielts/speaking/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/MediaPlayer", () => ({
  MediaPlayer: ({ src, label }: { src: string; label?: string }) => <div data-testid="player" data-src={src} aria-label={label} />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const PRONUNCIATION =
  "Estimated from the transcript only — the AI can't hear your accent or sounds. Your recording is kept so a later version can check pronunciation from audio.";

const part = (p: "p1" | "p2" | "p3", extra: Record<string, unknown> = {}) => ({
  part: p,
  kind: "audio" as const,
  mime: "audio/webm",
  stored: true,
  durationSec: 90,
  capSec: 420,
  transcript: `said in ${p}`,
  transcriptStatus: "done",
  markers: [{ atSec: 12, label: "filler words" }],
  mediaUrl: `https://r2.test/${p}.webm`,
  ...extra,
});

const attempt = (over: Partial<AttemptView> = {}): AttemptView => ({
  id: "64b000000000000000000001",
  date: "2026-11-10",
  kind: "mock",
  status: "complete",
  questions: {},
  generated: false,
  paused: false,
  videoUsed: false,
  parts: [part("p1"), part("p2"), part("p3")],
  ...over,
});

const SELF = { fluency: 6, lexical: 6, grammar: 6, pronunciation: 6 };
const AI = {
  bands: { fluency: 5, lexical: 6, grammar: 7, pronunciation: 6 },
  reasons: { fluency: "r1", lexical: "r2", grammar: "r3", pronunciation: "r4" },
  evidence: { fluency: [], lexical: [], grammar: [], pronunciation: [] },
  overall: 6,
  strengths: ["s1", "s2", "s3"],
  nextBand: [{ advice: "a", original: "o", rewrite: "w" }],
};

describe("AttemptReview", () => {
  it("hides the AI section until self bands are saved", () => {
    render(<AttemptReview attempt={attempt()} aiOn bodyConsent={false} />);
    expect(screen.getByRole("heading", { name: /rate yourself/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /ai estimate/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /get ai estimate/i })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the AI section after bands exist, with the comparison", () => {
    render(<AttemptReview attempt={attempt({ self: SELF, ai: AI })} aiOn bodyConsent={false} />);
    expect(screen.getByRole("heading", { name: /ai estimate/i })).toBeTruthy();
    expect(screen.getByRole("table", { name: /your bands and the ai estimate/i })).toBeTruthy();
  });

  it("reveals the AI section once the self bands are saved", async () => {
    const user = userEvent.setup();
    render(<AttemptReview attempt={attempt()} aiOn bodyConsent={false} />);
    for (const name of [/fluency/i, /lexical/i, /grammatical/i, /pronunciation/i]) {
      await user.selectOptions(screen.getByRole("combobox", { name }), "6");
    }
    await user.click(screen.getByRole("button", { name: /save my bands/i }));
    expect(await screen.findByRole("heading", { name: /ai estimate/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /get ai estimate/i })).toBeTruthy();
  });

  it("says the AI is off when it is", () => {
    render(<AttemptReview attempt={attempt({ self: SELF })} aiOn={false} bodyConsent={false} />);
    expect(screen.getByText(/the ai coach is turned off/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get ai estimate/i })).toBeNull();
  });

  it("shows the stored parts of an incomplete attempt and a delete button", () => {
    const a = attempt({
      status: "incomplete",
      parts: [part("p1"), { ...part("p2"), stored: false, mediaUrl: undefined, transcript: undefined, transcriptStatus: "none" }],
    });
    render(<AttemptReview attempt={a} aiOn bodyConsent={false} />);
    expect(screen.getByText(/this attempt is incomplete/i)).toBeTruthy();
    expect(screen.getAllByTestId("player")).toHaveLength(1);
    expect(screen.getByText("said in p1")).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete attempt/i })).toBeTruthy();
  });

  it("starts transcription for a pending part", async () => {
    const a = attempt({ kind: "part1", parts: [part("p1", { transcript: undefined, transcriptStatus: "pending" })] });
    render(<AttemptReview attempt={a} aiOn bodyConsent={false} />);
    expect(await screen.findByText("hello there")).toBeTruthy();
    expect(actions.transcribePartAction).toHaveBeenCalledWith(a.id, "p1");
  });

  it("lists markers as jump buttons", () => {
    render(<AttemptReview attempt={attempt({ kind: "part1", parts: [part("p1")] })} aiOn bodyConsent={false} />);
    expect(screen.getByRole("button", { name: /0:12 filler words/i })).toBeTruthy();
  });
});

describe("BandCompare", () => {
  it("shows the pronunciation note verbatim on a greyed row", () => {
    render(<BandCompare self={SELF} ai={AI} />);
    expect(screen.getByText(PRONUNCIATION)).toBeTruthy();
    const row = screen.getByText("Pronunciation").closest("tr")!;
    expect(row.getAttribute("data-greyed")).toBe("true");
  });

  it("highlights differences of 1.0 or more and labels every AI band an estimate", () => {
    render(<BandCompare self={SELF} ai={AI} />);
    expect(screen.getByText("Fluency and Coherence").closest("tr")!.getAttribute("data-differs")).toBe("true");
    expect(screen.getByText("Grammatical Range and Accuracy").closest("tr")!.getAttribute("data-differs")).toBe("true");
    expect(screen.getByText("Lexical Resource").closest("tr")!.getAttribute("data-differs")).toBeNull();
    expect(within(screen.getByRole("table")).getAllByText("estimate")).toHaveLength(5);
    expect(screen.getByText(/your own judgement stands/i)).toBeTruthy();
  });

  it("does not highlight a difference under 1.0", () => {
    render(<BandCompare self={SELF} ai={{ ...AI, bands: { ...AI.bands, fluency: 6.5, grammar: 6 }, overall: 6 }} />);
    expect(screen.getByText("Fluency and Coherence").closest("tr")!.getAttribute("data-differs")).toBeNull();
  });
});
