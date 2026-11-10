"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is not in TypeScript's DOM lib yet; this is the part the quiz uses.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in the browser to answer by voice.",
  "service-not-allowed": "Voice input is not allowed in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs a network connection.",
};

/**
 * Dictation through the browser's speech recognition (Chrome, Edge and Safari; the browser's
 * speech service does the transcription). Each finished phrase goes to `onFinal`; the phrase still
 * being spoken is `interim`. `supported` is false until mount, so server and client render alike.
 */
export function useSpeechInput(onFinal: (text: string) => void, lang?: string) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    // Feature detection must wait for the browser; the first render matches the server's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(recognitionCtor() !== null);
    return () => recognition.current?.abort();
  }, []);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recognition.current) return;
    const r = new Ctor();
    r.lang = lang || document.documentElement.lang || navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          if (text.trim()) onFinalRef.current(text.trim());
        } else pending += text;
      }
      setInterim(pending);
    };
    r.onerror = (e) => {
      // "no-speech" and "aborted" just end the take; the learner can press the mic again.
      if (e.error !== "no-speech" && e.error !== "aborted") setError(ERRORS[e.error] ?? "Voice input stopped. Try again.");
    };
    r.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim("");
    };
    recognition.current = r;
    setError("");
    try {
      r.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setError("Voice input could not start. Try again.");
    }
  }, [lang]);

  return { supported, listening, interim, error, start, stop };
}
