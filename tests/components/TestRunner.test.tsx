import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { saveAnswersAction, submitAttemptAction, claimSectionAction, finishSectionAction, refresh } = vi.hoisted(() => ({
  saveAnswersAction: vi.fn(),
  submitAttemptAction: vi.fn(),
  claimSectionAction: vi.fn(),
  finishSectionAction: vi.fn(async () => ({ ok: true })),
  refresh: vi.fn(),
}));
const { deleteTestAttemptAction, push } = vi.hoisted(() => ({ deleteTestAttemptAction: vi.fn(async () => ({ ok: true })), push: vi.fn() }));
vi.mock("@/app/(app)/ielts/practice-actions", () => ({ saveAnswersAction, submitAttemptAction, claimSectionAction, finishSectionAction, deleteTestAttemptAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

const confirmMock = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/components/ConfirmDialog", () => ({
  confirm: (...args: unknown[]) => confirmMock(...args),
  ConfirmHost: () => null,
}));

import { TestRunner } from "@/components/ielts/TestRunner";
import type { RunView } from "@/ielts/practice/attempts";

const view = (over: Partial<RunView> = {}): RunView => ({
  id: "a1",
  skill: "reading",
  title: "Test A",
  scope: "0",
  limitSec: 1200,
  startedAt: new Date().toISOString(),
  answers: {},
  audio: ["none"],
  played: [],
  sections: [
    {
      title: "Passage 1",
      passage: "The text.",
      hasAudio: false,
      groups: [
        {
          kind: "completion",
          instruction: "One word",
          options: [],
          questions: [{ n: 1, kind: "completion", prompt: "The ___", options: [] }],
        },
      ],
    },
  ],
  ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  confirmMock.mockResolvedValue(true);
});

describe("TestRunner", () => {
  it("shows the clock only after mounting and counts answers", async () => {
    render(<TestRunner view={view()} />);
    await waitFor(() => expect(screen.getByRole("timer").textContent).toMatch(/^(19|20):\d\d$/));
    expect(screen.getByText("0/1 answered")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Answer to question 1"), "cat");
    expect(screen.getByText("1/1 answered")).toBeTruthy();
  });

  it("autosaves answers after a pause", async () => {
    saveAnswersAction.mockResolvedValue({ ok: true });
    render(<TestRunner view={view()} />);
    await userEvent.type(screen.getByLabelText("Answer to question 1"), "cat");
    await waitFor(() => expect(saveAnswersAction).toHaveBeenCalledWith("a1", { "1": "cat" }), { timeout: 3000 });
  });

  it("lets arrow keys move through answer choices with one tab stop (U14)", async () => {
    const tfng = { kind: "tfng", instruction: "Agree?", options: [], questions: [{ n: 1, kind: "tfng", prompt: "Cats fly", options: [] }] };
    render(<TestRunner view={view({ sections: [{ ...view().sections[0], groups: [tfng as never] }] })} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[0].focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getAllByRole("radio")[1].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(screen.getAllByRole("radio")[1]);
  });

  it("says why when the server refuses an autosave (U5)", async () => {
    saveAnswersAction.mockResolvedValue({ ok: false, errors: { _: "Time is up for this test, so new answers aren't saved. Submit to see your score." } });
    render(<TestRunner view={view()} />);
    await userEvent.type(screen.getByLabelText("Answer to question 1"), "cat");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Time is up/), { timeout: 3000 });
  });

  it("retries a save that failed, so answers are not left only in memory", async () => {
    saveAnswersAction.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true });
    render(<TestRunner view={view()} />);
    await userEvent.type(screen.getByLabelText("Answer to question 1"), "x");
    await waitFor(() => expect(saveAnswersAction).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await waitFor(() => expect(saveAnswersAction).toHaveBeenCalledTimes(2), { timeout: 9000 });
    expect(saveAnswersAction).toHaveBeenLastCalledWith("a1", { "1": "x" });
  }, 20000);

  it("submits with the typed answers and allows another try after a failure", async () => {
    submitAttemptAction.mockResolvedValueOnce({ ok: false, errors: { _: "Try again" } }).mockResolvedValue({ ok: true, raw: 1, total: 1 });
    confirmMock.mockResolvedValue(true);
    render(<TestRunner view={view()} />);
    await userEvent.type(screen.getByLabelText("Answer to question 1"), "cat");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByText("Try again")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitAttemptAction).toHaveBeenCalledTimes(2));
    expect(submitAttemptAction).toHaveBeenLastCalledWith("a1", { "1": "cat" });
  });

  it("does not lock the guard when the unanswered-questions prompt is declined", async () => {
    submitAttemptAction.mockResolvedValue({ ok: true, raw: 0, total: 1 });
    confirmMock.mockResolvedValueOnce(false).mockResolvedValue(true);
    render(<TestRunner view={view()} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(submitAttemptAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitAttemptAction).toHaveBeenCalledTimes(1));
    expect(confirmMock).toHaveBeenCalledTimes(2);
  });

  it("fetches the script for the computer voice only when play is pressed", async () => {
    claimSectionAction.mockResolvedValue({ ok: true, play: { kind: "voice", script: "Hello there" } });
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; lang = ""; onend = null; onerror = null; constructor(t: string) { this.text = t; } });
    render(<TestRunner view={view({ skill: "listening", scope: "full", audio: ["voice"], sections: [{ ...view().sections[0], hasAudio: true }] })} />);
    expect(claimSectionAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Play audio" }));
    expect(claimSectionAction).toHaveBeenCalledWith("a1", 0);
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("button", { name: "Playing..." }) as HTMLButtonElement).disabled).toBe(true);
    vi.unstubAllGlobals();
  });

  it("signs a recording only at Play, and a full test gives no controls or second play", async () => {
    claimSectionAction.mockResolvedValueOnce({ ok: true, play: { kind: "file", url: "https://r2.test/a.mp3?sig" } });
    const { container } = render(
      <TestRunner view={view({ skill: "listening", scope: "full", audio: ["file"], sections: [{ ...view().sections[0], hasAudio: true }] })} />,
    );
    expect(container.querySelector("audio")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Play audio" }));
    expect(claimSectionAction).toHaveBeenCalledWith("a1", 0);
    await waitFor(() => expect(container.querySelector("audio")?.getAttribute("src")).toBe("https://r2.test/a.mp3?sig"));
    expect(container.querySelector("audio")?.hasAttribute("controls")).toBe(false);
    expect((screen.getByRole("button", { name: "Playing..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets the learner try again when the claim is refused", async () => {
    claimSectionAction.mockResolvedValueOnce({ ok: false, errors: { _: "This section has already been played. A full test plays it once." } });
    render(<TestRunner view={view({ skill: "listening", scope: "full", audio: ["file"], sections: [{ ...view().sections[0], hasAudio: true }] })} />);
    await userEvent.click(screen.getByRole("button", { name: "Play audio" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/already been played/));
  });

  it("keeps a full-test recording playing across a section switch and uses the play only at the end (F1)", async () => {
    claimSectionAction.mockResolvedValueOnce({ ok: true, play: { kind: "file", url: "https://r2.test/a.mp3?sig" } });
    const two = { ...view().sections[0], hasAudio: true };
    const { container } = render(
      <TestRunner view={view({ skill: "listening", scope: "full", audio: ["file", "none"], sections: [two, { ...two, title: "Part 2" }] })} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Play audio" }));
    await waitFor(() => expect(container.querySelector("audio")).not.toBeNull());
    const audio = container.querySelector("audio")!;
    await userEvent.click(screen.getByRole("tab", { name: "Part 2" }));
    expect(container.querySelector("audio")).toBe(audio);
    expect(finishSectionAction).not.toHaveBeenCalled();
    audio.dispatchEvent(new Event("ended"));
    await waitFor(() => expect(finishSectionAction).toHaveBeenCalledWith("a1", 0));
  });

  it("lets a full-test section be played again after a load error, and shows heard sections as played", async () => {
    claimSectionAction.mockResolvedValueOnce({ ok: true, play: { kind: "file", url: "https://r2.test/a.mp3?sig" } });
    const s = { ...view().sections[0], hasAudio: true };
    const { container } = render(<TestRunner view={view({ skill: "listening", scope: "full", audio: ["file", "file"], played: [1], sections: [s, { ...s, title: "Part 2" }] })} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Play audio" })[0]);
    await waitFor(() => expect(container.querySelector("audio")).not.toBeNull());
    container.querySelector("audio")!.dispatchEvent(new Event("error"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't be loaded/));
    expect((screen.getAllByRole("button", { name: "Play audio" })[0] as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Played", hidden: true })).toBeTruthy();
  });

  it("discards the attempt after a confirm and goes back to the skill page (F4)", async () => {
    confirmMock.mockResolvedValue(true);
    render(<TestRunner view={view()} />);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(deleteTestAttemptAction).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/ielts/reading"));
  });
});
