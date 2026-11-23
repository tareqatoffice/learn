import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShadowPractice } from "@/features/speaking/components/ShadowPractice";
import { ShadowPlayer, mixVolumes } from "@/features/speaking/components/ShadowPlayer";
import { SentenceTimer } from "@/features/admin/components/SpeakingLessonForm";
import { timeline } from "@/features/speaking/shadowText";

vi.mock("@/app/(app)/admin/speaking/actions", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("pause"));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sentences = timeline("First one. Second one. Third one.", 30, [0, 10, 20]);

describe("ShadowPractice", () => {
  it("plays and pauses the clip", async () => {
    render(<ShadowPractice src="https://x.test/a.mp3" sentences={sentences} rate={1} onRate={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Play/ }));
    expect(play).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Pause/ }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Play/ })).toBeTruthy();
  });

  it("jumps to a tapped sentence and repeats it", async () => {
    const { container } = render(<ShadowPractice src="https://x.test/a.mp3" sentences={sentences} rate={1} onRate={() => {}} />);
    const audio = container.querySelector("audio")!;
    await userEvent.click(screen.getByRole("button", { name: "Second one." }));
    expect(audio.currentTime).toBe(10);
    expect(screen.getByRole("button", { name: "Second one." }).closest("li")?.getAttribute("aria-current")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Repeat sentence" }));
    expect(screen.getByRole("button", { name: "Repeating sentence 2" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Next sentence" }));
    expect(audio.currentTime).toBe(20);
    expect(screen.getByRole("button", { name: "Repeating sentence 3" })).toBeTruthy();
  });

  it("sets the clip speed", async () => {
    const onRate = vi.fn();
    const { container, rerender } = render(<ShadowPractice src="https://x.test/a.mp3" sentences={sentences} rate={1} onRate={onRate} />);
    await userEvent.click(screen.getByRole("button", { name: "0.75×" }));
    expect(onRate).toHaveBeenCalledWith(0.75);
    rerender(<ShadowPractice src="https://x.test/a.mp3" sentences={sentences} rate={0.75} onRate={onRate} />);
    expect(container.querySelector("audio")!.playbackRate).toBe(0.75);
    expect(screen.getByRole("button", { name: "0.75×" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("ShadowPlayer", () => {
  it("plays source then take, with pause and resume", async () => {
    const { container } = render(<ShadowPlayer sourceUrl="https://x.test/s.mp3" takeUrl="https://x.test/t.webm" rate={0.75} />);
    const [source, take] = container.querySelectorAll("audio");
    expect(source.playbackRate).toBe(0.75);
    await userEvent.click(screen.getByRole("button", { name: /Play source, then my take/ }));
    expect(screen.getByRole("status").textContent).toContain("Playing the source");
    await userEvent.click(screen.getByRole("button", { name: /Pause/ }));
    expect(screen.getByRole("status").textContent).toBe("Paused");
    await userEvent.click(screen.getByRole("button", { name: /Resume/ }));
    fireEvent.ended(source);
    expect(screen.getByRole("status").textContent).toContain("Playing your take");
    fireEvent.ended(take);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("plays both together with a volume mix", async () => {
    const { container } = render(<ShadowPlayer sourceUrl="https://x.test/s.mp3" takeUrl="https://x.test/t.webm" />);
    const [source, take] = container.querySelectorAll("audio");
    await userEvent.click(screen.getByRole("button", { name: "Together" }));
    fireEvent.change(screen.getByLabelText("Mix between the source and your take"), { target: { value: "75" } });
    expect(source.volume).toBeCloseTo(0.5);
    expect(take.volume).toBe(1);
    play.mockClear();
    await userEvent.click(screen.getByRole("button", { name: /Play both together/ }));
    expect(play).toHaveBeenCalledTimes(2);
    expect(mixVolumes(50)).toEqual({ source: 1, take: 1 });
  });
});

describe("ShadowPlayer highlight", () => {
  it("stops reporting the source time after Stop", async () => {
    const onSourceTime = vi.fn();
    const { container } = render(<ShadowPlayer sourceUrl="https://x.test/s.mp3" takeUrl="https://x.test/t.webm" onSourceTime={onSourceTime} />);
    const [source] = container.querySelectorAll("audio");
    fireEvent.timeUpdate(source);
    expect(onSourceTime).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Play source, then my take/ }));
    fireEvent.timeUpdate(source);
    expect(onSourceTime).toHaveBeenLastCalledWith(0);
    await userEvent.click(screen.getByRole("button", { name: /Stop/ }));
    fireEvent.timeUpdate(source);
    expect(onSourceTime).toHaveBeenLastCalledWith(null);
  });
});

describe("SentenceTimer", () => {
  it("marks each sentence start from the clip time", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<SentenceTimer text="A. B." src="https://x.test/a.mp3" marks={[]} onChange={onChange} />);
    const audio = container.querySelector("audio")!;
    audio.currentTime = 1.24;
    await userEvent.click(screen.getByRole("button", { name: "Mark sentence 1" }));
    expect(onChange).toHaveBeenLastCalledWith([1.2]);
    rerender(<SentenceTimer text="A. B." src="https://x.test/a.mp3" marks={[1.2]} onChange={onChange} />);
    audio.currentTime = 4;
    await userEvent.click(screen.getByRole("button", { name: "Mark sentence 2" }));
    expect(onChange).toHaveBeenLastCalledWith([1.2, 4]);
    rerender(<SentenceTimer text="A. B." src="https://x.test/a.mp3" marks={[1.2, 4]} onChange={onChange} />);
    expect(screen.getByRole("status").textContent).toBe("All 2 sentences timed.");
    rerender(<SentenceTimer text="A." src="https://x.test/a.mp3" marks={[1.2, 4]} onChange={onChange} />);
    expect(screen.getByRole("status").textContent).toContain("no longer fit");
  });
});
