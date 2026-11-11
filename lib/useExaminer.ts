"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const SPEAK_TIMEOUT_MS = 15_000;
// Errors from our own cancel(), not a broken voice.
const CANCELLED = new Set(["interrupted", "canceled"]);

const synth = (): SpeechSynthesis | null =>
  typeof window !== "undefined" && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined"
    ? window.speechSynthesis
    : null;

const noSubscribe = () => () => {};

/** First en-GB voice, then any English voice (some browsers write `en_GB`). */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();
  return voices.find((v) => lang(v) === "en-gb") ?? voices.find((v) => lang(v).startsWith("en-")) ?? null;
}

/**
 * The examiner's voice via speechSynthesis. `speak` resolves on end, on error or after 15 s, whichever
 * comes first. After one error the voice counts as failed and later calls resolve at once, so the
 * runner carries on with the questions as text. On iOS the first `speak` must run inside a tap.
 */
export function useExaminer({ enabled }: { enabled: boolean }) {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => synth() !== null,
    () => false,
  );
  const [failed, setFailed] = useState(false);
  const failedRef = useRef(false);
  const voices = useRef<SpeechSynthesisVoice[]>([]);

  const speak = useCallback(
    (text: string): Promise<void> => {
      const s = synth();
      if (!enabled || !s || failedRef.current || !text.trim()) return Promise.resolve();
      return new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(done, SPEAK_TIMEOUT_MS);
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "en-GB";
          const now = s.getVoices?.() ?? [];
          const voice = pickVoice(now.length ? now : voices.current);
          if (voice) u.voice = voice;
          u.addEventListener("end", done);
          u.addEventListener("error", (e: SpeechSynthesisErrorEvent) => {
            if (!CANCELLED.has(e.error)) {
              failedRef.current = true;
              setFailed(true);
            }
            done();
          });
          // One question at a time: cut off the previous one rather than queue behind it.
          if (s.speaking || s.pending) s.cancel();
          s.speak(u);
        } catch {
          failedRef.current = true;
          setFailed(true);
          done();
        }
      });
    },
    [enabled],
  );

  // Some browsers (Chrome) load voices after the page: keep the list once it arrives.
  useEffect(() => {
    const s = synth();
    if (!s) return;
    const load = () => {
      voices.current = s.getVoices?.() ?? [];
    };
    load();
    s.addEventListener?.("voiceschanged", load, { once: true });
    return () => {
      s.removeEventListener?.("voiceschanged", load);
      s.cancel();
    };
  }, []);

  return { speak, supported, failed };
}
