// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useExaminer } from "@/lib/useExaminer";

class FakeUtterance {
  static last: FakeUtterance | null = null;
  lang = "";
  voice: { lang: string; name: string } | null = null;
  rate = 1;
  private listeners: Record<string, ((e: { error?: string }) => void)[]> = {};
  constructor(public text: string) {
    FakeUtterance.last = this;
  }
  addEventListener(type: string, fn: (e: { error?: string }) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  emit(type: string, e: { error?: string } = {}) {
    for (const fn of this.listeners[type] ?? []) fn(e);
  }
}

function installSpeech(voices: { lang: string; name: string }[] = []) {
  const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => voices };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return synth;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeUtterance.last = null;
});

describe("useExaminer", () => {
  it("is unsupported without speechSynthesis and speak resolves at once", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const { result } = renderHook(() => useExaminer({ enabled: true }));
    expect(result.current.supported).toBe(false);
    await expect(result.current.speak("Hello")).resolves.toBeUndefined();
  });

  it("speaks with the first en-GB voice and resolves on end", async () => {
    const synth = installSpeech([
      { lang: "fr-FR", name: "Amélie" },
      { lang: "en-US", name: "Samantha" },
      { lang: "en_GB", name: "Daniel" },
    ]);
    const { result } = renderHook(() => useExaminer({ enabled: true }));
    expect(result.current.supported).toBe(true);
    let done = false;
    const p = result.current.speak("Where do you live?").then(() => (done = true));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(FakeUtterance.last?.voice?.name).toBe("Daniel");
    await Promise.resolve();
    expect(done).toBe(false);
    FakeUtterance.last!.emit("end");
    await p;
    expect(done).toBe(true);
  });

  it("falls back to any en voice when there is no en-GB voice", () => {
    installSpeech([
      { lang: "de-DE", name: "Anna" },
      { lang: "en-AU", name: "Karen" },
    ]);
    const { result } = renderHook(() => useExaminer({ enabled: true }));
    void result.current.speak("Hi");
    expect(FakeUtterance.last?.voice?.name).toBe("Karen");
  });

  it("uses the en-GB voice once voices load after the page", () => {
    let loaded: { lang: string; name: string }[] = [];
    const listeners: Record<string, () => void> = {};
    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: () => loaded,
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    const { result } = renderHook(() => useExaminer({ enabled: true }));
    expect(listeners.voiceschanged).toBeTypeOf("function");
    loaded = [{ lang: "en-GB", name: "Daniel" }];
    listeners.voiceschanged();
    // A browser that then reports no voices on the call still gets the loaded one.
    loaded = [];
    void result.current.speak("Hello");
    expect(FakeUtterance.last?.voice?.name).toBe("Daniel");
  });

  it("sets failed after an error event, and later calls resolve at once without speaking", async () => {
    const synth = installSpeech();
    const { result } = renderHook(() => useExaminer({ enabled: true }));
    const p = result.current.speak("First");
    await act(async () => {
      FakeUtterance.last!.emit("error", { error: "synthesis-failed" });
      await p;
    });
    expect(result.current.failed).toBe(true);
    await result.current.speak("Second");
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("does not count its own cancel as a failure", async () => {
    installSpeech();
    const { result } = renderHook(() => useExaminer({ enabled: true }));
    const p = result.current.speak("First");
    await act(async () => {
      FakeUtterance.last!.emit("error", { error: "interrupted" });
      await p;
    });
    expect(result.current.failed).toBe(false);
  });

  it("resolves after 15 s when no event arrives", async () => {
    vi.useFakeTimers();
    installSpeech();
    const { result } = renderHook(() => useExaminer({ enabled: true }));
    let done = false;
    void result.current.speak("Silent").then(() => (done = true));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it("stays silent when turned off", async () => {
    const synth = installSpeech();
    const { result } = renderHook(() => useExaminer({ enabled: false }));
    await result.current.speak("Hello");
    expect(synth.speak).not.toHaveBeenCalled();
  });
});
