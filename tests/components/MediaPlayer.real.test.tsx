// @vitest-environment jsdom
// Uses the real react-player (no mock) to check the wiring our player depends on.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaPlayer } from "@/components/MediaPlayer";

afterEach(cleanup);

async function mount(props: { video?: boolean } = {}) {
  let el: HTMLVideoElement | null = null;
  const refs = vi.fn((node: HTMLVideoElement | null) => {
    if (node) el = node;
  });
  render(<MediaPlayer src="https://x.test/a.mp3" playerRef={refs} {...props} />);
  await waitFor(() => expect(el).not.toBeNull());
  return el as unknown as HTMLVideoElement;
}

describe("MediaPlayer with the real react-player", () => {
  it("exposes the media element and follows its play/pause events", async () => {
    const el = await mount();
    expect(el.tagName).toMatch(/AUDIO|VIDEO/);
    act(() => {
      el.dispatchEvent(new Event("play"));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause Audio" })).toBeTruthy());
    act(() => {
      el.dispatchEvent(new Event("pause"));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Play Audio" })).toBeTruthy());
  });

  it("lets the user retry after an error", async () => {
    const el = await mount();
    el.load = vi.fn();
    act(() => {
      el.dispatchEvent(new Event("error"));
    });
    await waitFor(() => expect(screen.getByText(/press play to retry/i)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Play Audio" }));
    expect(el.load).toHaveBeenCalled();
    expect(screen.queryByText(/press play to retry/i)).toBeNull();
  });

  it("offers mute, speed and (video only) fullscreen", async () => {
    await mount({ video: true });
    fireEvent.click(screen.getByRole("button", { name: "Mute Video" }));
    expect(screen.getByRole("button", { name: "Unmute Video" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Playback speed 1x" }));
    expect(screen.getByRole("button", { name: "Playback speed 1.25x" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fullscreen" })).toBeTruthy();
  });
});
