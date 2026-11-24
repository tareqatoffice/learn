import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShadowMatch } from "@/features/speaking/components/ShadowMatch";
import { ShadowPlayer } from "@/features/speaking/components/ShadowPlayer";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ShadowMatch", () => {
  it("shows the score and the words that were not heard", () => {
    render(<ShadowMatch reference="The quick brown fox jumps." transcript="the quick fox jumps over" />);
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText(/4 of 5 words/)).toBeTruthy();
    expect(screen.getByText("brown")).toBeTruthy();
  });

  it("renders nothing when the text has no words", () => {
    const { container } = render(<ShadowMatch reference="..." transcript="hello" />);
    expect(container.textContent).toBe("");
  });
});

describe("ShadowPlayer line-up", () => {
  let play: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    play = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  const playedSrcs = () => (play.mock.contexts as HTMLMediaElement[]).map((el) => el.getAttribute("src"));

  function together(nudge: string) {
    render(<ShadowPlayer sourceUrl="https://x.test/source.mp3" takeUrl="https://x.test/take.webm" />);
    fireEvent.click(screen.getByRole("button", { name: "Together" }));
    fireEvent.change(screen.getByLabelText("Line up the source and your take"), { target: { value: nudge } });
    fireEvent.click(screen.getByRole("button", { name: /play both together/i }));
  }

  it("starts the take later when the line-up is positive", () => {
    together("0.5");
    expect(playedSrcs()).toEqual(["https://x.test/source.mp3"]);
    act(() => void vi.advanceTimersByTime(500));
    expect(playedSrcs()).toEqual(["https://x.test/source.mp3", "https://x.test/take.webm"]);
  });

  it("starts the source later when the line-up is negative", () => {
    together("-0.5");
    expect(playedSrcs()).toEqual(["https://x.test/take.webm"]);
    act(() => void vi.advanceTimersByTime(500));
    expect(playedSrcs()).toEqual(["https://x.test/take.webm", "https://x.test/source.mp3"]);
  });

  it("keeps the remaining delay when paused and resumed before the delayed player starts", () => {
    together("0.5");
    act(() => void vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    act(() => void vi.advanceTimersByTime(1000));
    expect(playedSrcs()).toEqual(["https://x.test/source.mp3"]);
    fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(playedSrcs()).toEqual(["https://x.test/source.mp3", "https://x.test/source.mp3"]);
    act(() => void vi.advanceTimersByTime(300));
    expect(playedSrcs()).toEqual(["https://x.test/source.mp3", "https://x.test/source.mp3", "https://x.test/take.webm"]);
  });
});
