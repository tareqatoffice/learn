// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecorder } from "@/lib/useRecorder";

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supported: (m: string) => boolean = (m: string) => m === "audio/webm;codecs=opus" || m === "video/webm;codecs=vp9,opus";
  static isTypeSupported(m: string) {
    return FakeRecorder.supported(m);
  }
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  mimeType: string;
  constructor(
    public stream: MediaStream,
    public options: { mimeType: string; audioBitsPerSecond?: number; videoBitsPerSecond?: number },
  ) {
    this.mimeType = options.mimeType;
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["data"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function fakeStream(kinds: ("audio" | "video")[]) {
  const tracks = kinds.map((kind) => {
    const listeners: Record<string, (() => void)[]> = {};
    return {
      kind,
      stop: vi.fn(),
      addEventListener: (e: string, fn: () => void) => (listeners[e] ??= []).push(fn),
      fire: (e: string) => listeners[e]?.forEach((fn) => fn()),
    };
  });
  return {
    tracks,
    stream: {
      getTracks: () => tracks,
      getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
      getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    } as unknown as MediaStream,
  };
}

let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecorder.instances = [];
  FakeRecorder.supported = (m) => m === "audio/webm;codecs=opus" || m === "video/webm;codecs=vp9,opus";
  getUserMedia = vi.fn();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal(
    "MediaStream",
    class {
      constructor(public tracks: unknown[]) {}
      getTracks() {
        return this.tracks;
      }
    },
  );
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useRecorder", () => {
  it("records audio and releases the tracks on stop", async () => {
    const { tracks, stream } = fakeStream(["audio"]);
    getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("recording");
    expect(getUserMedia.mock.calls[0][0].audio).toBeTruthy();
    expect(getUserMedia.mock.calls[0][0].video).toBeFalsy();
    expect(FakeRecorder.instances[0].options.audioBitsPerSecond).toBe(48_000);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.elapsedSec).toBe(2);
    act(() => result.current.stop());
    expect(result.current.state).toBe("stopped");
    expect(result.current.result?.mime).toBe("audio/webm");
    expect(result.current.result?.durationSec).toBe(2);
    expect(result.current.result?.blob.size).toBeGreaterThan(0);
    expect(tracks[0].stop).toHaveBeenCalled();
    act(() => result.current.reset());
    expect(result.current.state).toBe("idle");
    expect(result.current.result).toBeNull();
  });

  it("auto-stops at capSec", async () => {
    getUserMedia.mockResolvedValue(fakeStream(["audio"]).stream);
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 3 }));
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(result.current.state).toBe("stopped");
    expect(result.current.result?.durationSec).toBe(3);
  });

  it("stops and keeps data on visibilitychange hidden", async () => {
    getUserMedia.mockResolvedValue(fakeStream(["audio"]).stream);
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect(result.current.state).toBe("stopped");
    expect(result.current.result?.blob.size).toBeGreaterThan(0);
  });

  it("stops and keeps data on pagehide", async () => {
    getUserMedia.mockResolvedValue(fakeStream(["audio"]).stream);
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(result.current.state).toBe("stopped");
    expect(result.current.result).not.toBeNull();
  });

  it("video records a parallel audio-only blob", async () => {
    const { tracks, stream } = fakeStream(["audio", "video"]);
    getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRecorder({ kind: "video", capSec: 60 }));
    await act(async () => {
      await result.current.start();
    });
    expect(getUserMedia.mock.calls[0][0].video.facingMode).toBe("user");
    expect(FakeRecorder.instances).toHaveLength(2);
    expect(FakeRecorder.instances[0].options.videoBitsPerSecond).toBe(600_000);
    expect(result.current.stream).toBe(stream);
    act(() => result.current.stop());
    expect(result.current.result?.mime).toBe("video/webm");
    expect(result.current.result?.audioMime).toBe("audio/webm");
    expect(result.current.result?.audioBlob?.size).toBeGreaterThan(0);
    expect(tracks.every((t) => t.stop.mock.calls.length > 0)).toBe(true);
  });

  it("maps NotAllowedError to the blocked message", async () => {
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    getUserMedia.mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("Microphone or camera access was blocked. Allow it in the browser to record.");
  });

  it("maps NotFoundError to the missing-device message", async () => {
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    getUserMedia.mockRejectedValue(Object.assign(new Error("x"), { name: "NotFoundError" }));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.error).toBe("No microphone or camera was found.");
  });

  it("reports an unsupported browser", async () => {
    FakeRecorder.supported = () => false;
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("This browser can't record. Try Chrome, Edge or Safari.");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("releases the tracks on unmount", async () => {
    const { tracks, stream } = fakeStream(["audio"]);
    getUserMedia.mockResolvedValue(stream);
    const { result, unmount } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    await act(async () => {
      await result.current.start();
    });
    unmount();
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it("finishes when the recorder stops on its own", async () => {
    const { tracks, stream } = fakeStream(["audio"]);
    getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
      FakeRecorder.instances[0].stop();
    });
    expect(result.current.state).toBe("stopped");
    expect(result.current.result?.durationSec).toBe(2);
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it("finishes when a track ends", async () => {
    const { tracks, stream } = fakeStream(["audio"]);
    getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
      tracks[0].fire("ended");
    });
    expect(result.current.state).toBe("stopped");
    expect(result.current.result).not.toBeNull();
  });

  it("does not start recording if reset during the permission prompt", async () => {
    const { tracks, stream } = fakeStream(["audio"]);
    let resolve!: (s: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise<MediaStream>((r) => (resolve = r)));
    const { result } = renderHook(() => useRecorder({ kind: "audio", capSec: 60 }));
    let started!: Promise<void>;
    act(() => {
      started = result.current.start();
    });
    expect(result.current.state).toBe("asking");
    act(() => result.current.reset());
    await act(async () => {
      resolve(stream);
      await started;
    });
    expect(result.current.state).toBe("idle");
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(tracks[0].stop).toHaveBeenCalled();
  });
});
