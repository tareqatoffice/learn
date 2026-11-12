// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ReactPlayer's `playing` prop drives the media element; the mock exposes it and the event props.
vi.mock("react-player", () => ({
  default: ({ playing, onDurationChange, onTimeUpdate, ref }: Record<string, unknown>) => {
    const el = { currentTime: 0, duration: 125 };
    (ref as (n: unknown) => void)?.(el);
    return (
      <div
        data-testid="player"
        data-playing={String(playing)}
        onClick={() => {
          (onDurationChange as (e: unknown) => void)({ currentTarget: el });
          (onTimeUpdate as (e: unknown) => void)({ currentTarget: { currentTime: 65 } });
        }}
      />
    );
  },
}));

import { MediaPlayer } from "@/components/MediaPlayer";

afterEach(cleanup);

describe("MediaPlayer", () => {
  it("toggles play and pause", () => {
    render(<MediaPlayer src="https://x.test/a.mp3" label="clip" />);
    const btn = screen.getByRole("button", { name: "Play clip" });
    expect(screen.getByTestId("player").dataset.playing).toBe("false");
    fireEvent.click(btn);
    expect(screen.getByTestId("player").dataset.playing).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause clip" }));
    expect(screen.getByTestId("player").dataset.playing).toBe("false");
  });

  it("labels video controls and plays and pauses with the button", () => {
    render(<MediaPlayer src="https://x.test/a.webm" video />);
    fireEvent.click(screen.getByRole("button", { name: "Play Video" }));
    expect(screen.getByTestId("player").dataset.playing).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause Video" }));
    expect(screen.getByTestId("player").dataset.playing).toBe("false");
  });

  it("shows elapsed and total time once the media reports them", () => {
    render(<MediaPlayer src="https://x.test/a.mp3" />);
    fireEvent.click(screen.getByTestId("player"));
    expect(screen.getByText("1:05 / 2:05")).toBeTruthy();
  });
});
