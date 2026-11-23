import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-player", () => ({
  default: ({ playing, onDurationChange, onTimeUpdate, onError, ref, src }: Record<string, unknown>) => {
    const el = { currentTime: 0, duration: 125 };
    (ref as (n: unknown) => void)?.(el);
    return (
      <div
        data-testid="player"
        data-playing={String(playing)}
        data-src={String(src)}
        onDoubleClick={() => (onError as () => void)()}
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
    expect(screen.getByTestId("player").dataset.playing).not.toBe("true");
    fireEvent.click(btn);
    expect(screen.getByTestId("player").dataset.playing).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause clip" }));
    expect(screen.getByTestId("player").dataset.playing).not.toBe("true");
  });

  it("labels video controls and plays and pauses with the button", () => {
    render(<MediaPlayer src="https://x.test/a.webm" video />);
    fireEvent.click(screen.getByRole("button", { name: "Play Video" }));
    expect(screen.getByTestId("player").dataset.playing).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause Video" }));
    expect(screen.getByTestId("player").dataset.playing).not.toBe("true");
  });

  it("shows the stored length while the file reports none (F5)", () => {
    render(<MediaPlayer src="https://x.test/a.webm" fallbackDuration={90} />);
    expect(screen.getByText("0:00 / 1:30")).toBeTruthy();
  });

  it("asks for a freshly signed link when playback fails (F5)", async () => {
    const refreshSrc = vi.fn(async () => "https://x.test/fresh.webm");
    render(<MediaPlayer src="https://x.test/old.webm" label="clip" refreshSrc={refreshSrc} />);
    fireEvent.doubleClick(screen.getByTestId("player"));
    fireEvent.click(screen.getByRole("button", { name: "Play clip" }));
    await waitFor(() => expect(screen.getByTestId("player").dataset.src).toBe("https://x.test/fresh.webm"));
    expect(refreshSrc).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("player").dataset.playing).toBe("true");
  });

  it("shows elapsed and total time once the media reports them", () => {
    render(<MediaPlayer src="https://x.test/a.mp3" />);
    fireEvent.click(screen.getByTestId("player"));
    expect(screen.getByText("1:05 / 2:05")).toBeTruthy();
  });
});
