"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { baseMime, pickMime } from "@/lib/media";

export type RecorderState =
  "idle" | "asking" | "recording" | "stopped" | "error";

export type RecorderResult = {
  blob: Blob;
  audioBlob?: Blob;
  /** Base mime type (no codecs), the form the upload URL is signed for. */
  mime: string;
  audioMime?: string;
  durationSec: number;
};

const AUDIO_BPS = 48_000;
const VIDEO_BPS = 600_000;

const MSG_BLOCKED =
  "Microphone or camera access was blocked. Allow it in the browser to record.";
const MSG_NOT_FOUND = "No microphone or camera was found.";
const MSG_UNSUPPORTED =
  "This browser can't record. Try Chrome, Edge or Safari.";
const MSG_FAILED = "Recording failed. Try again.";

function errorMessage(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return MSG_BLOCKED;
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return MSG_NOT_FOUND;
  return MSG_FAILED;
}

type Take = { recorder: MediaRecorder; chunks: Blob[]; mime: string };

function makeTake(
  stream: MediaStream,
  mime: string,
  bitrate: Record<string, number>,
): Take {
  const recorder = new MediaRecorder(stream, { mimeType: mime, ...bitrate });
  const take: Take = { recorder, chunks: [], mime: baseMime(mime) };
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) take.chunks.push(e.data);
  };
  return take;
}

/**
 * Records a speaking take with MediaRecorder (audio, or camera + mic with a parallel audio-only
 * recording for transcription). `start` must be called from a user gesture (iOS Safari). The take
 * stops at `capSec`, and also when the page is hidden or locked, keeping what was recorded.
 */
export function useRecorder({
  kind,
  capSec,
}: {
  kind: "audio" | "video";
  capSec: number;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [result, setResult] = useState<RecorderResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const main = useRef<Take | null>(null);
  const side = useRef<Take | null>(null);
  const startedAt = useRef(0);
  const finishing = useRef(false);
  const asking = useRef(false);
  const askId = useRef(0);
  const timers = useRef<{
    tick?: ReturnType<typeof setInterval>;
    cap?: ReturnType<typeof setTimeout>;
  }>({});
  const mounted = useRef(true);

  const clearTimers = () => {
    clearInterval(timers.current.tick);
    clearTimeout(timers.current.cap);
    timers.current = {};
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    clearTimers();
    const takes = [main.current, side.current].filter((t): t is Take => !!t);
    const durationSec = Math.min(
      capSec,
      Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
    );
    let pending = takes.length;
    const settle = () => {
      if (--pending > 0) return;
      releaseStream();
      const m = main.current;
      const s = side.current;
      main.current = null;
      side.current = null;
      if (!mounted.current) return;
      setStream(null);
      setElapsedSec(durationSec);
      if (!m || m.chunks.length === 0) {
        setError(MSG_FAILED);
        setState("error");
        return;
      }
      const blobOf = (t: Take) => new Blob(t.chunks, { type: t.mime });
      setResult({
        blob: blobOf(m),
        mime: m.mime,
        durationSec,
        ...(s && s.chunks.length > 0
          ? { audioBlob: blobOf(s), audioMime: s.mime }
          : {}),
      });
      setState("stopped");
    };
    for (const t of takes) {
      if (t.recorder.state === "inactive") {
        settle();
        continue;
      }
      t.recorder.onstop = settle;
      try {
        t.recorder.stop();
      } catch {
        settle();
      }
    }
  }, [capSec]);

  const start = useCallback(async () => {
    if (asking.current || main.current) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(MSG_UNSUPPORTED);
      setState("error");
      return;
    }
    const supported = (m: string) => MediaRecorder.isTypeSupported(m);
    const mime = pickMime(kind, supported);
    const audioMime = kind === "video" ? pickMime("audio", supported) : null;
    if (!mime || (kind === "video" && !audioMime)) {
      setError(MSG_UNSUPPORTED);
      setState("error");
      return;
    }

    asking.current = true;
    const myAsk = ++askId.current;
    setError("");
    setResult(null);
    setElapsedSec(0);
    setState("asking");
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia(
        kind === "video"
          ? {
              audio: true,
              video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
            }
          : { audio: true },
      );
    } catch (e) {
      if (myAsk !== askId.current) return; // cancelled while asking
      asking.current = false;
      if (!mounted.current) return;
      setError(errorMessage(e));
      setState("error");
      return;
    }
    if (myAsk !== askId.current) {
      // reset() or a page hide happened while the permission prompt was open.
      media.getTracks().forEach((t) => t.stop());
      return;
    }
    asking.current = false;
    if (!mounted.current) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }

    try {
      streamRef.current = media;
      if (kind === "video") {
        main.current = makeTake(media, mime, {
          videoBitsPerSecond: VIDEO_BPS,
          audioBitsPerSecond: AUDIO_BPS,
        });
        side.current = makeTake(
          new MediaStream(media.getAudioTracks()),
          audioMime!,
          { audioBitsPerSecond: AUDIO_BPS },
        );
      } else {
        main.current = makeTake(media, mime, { audioBitsPerSecond: AUDIO_BPS });
        side.current = null;
      }
      // The recorder can end on its own (mic unplugged, permission revoked, iOS audio interruption).
      main.current.recorder.onerror = () => finish();
      for (const t of [main.current, side.current]) {
        if (t) t.recorder.onstop = () => finish();
      }
      media
        .getTracks()
        .forEach((t) => t.addEventListener("ended", () => finish()));
      finishing.current = false;
      startedAt.current = Date.now();
      main.current.recorder.start();
      side.current?.recorder.start();
    } catch {
      releaseStream();
      main.current = null;
      side.current = null;
      setError(MSG_FAILED);
      setState("error");
      return;
    }

    setStream(media);
    setState("recording");
    timers.current.tick = setInterval(() => {
      setElapsedSec(
        Math.min(capSec, Math.round((Date.now() - startedAt.current) / 1000)),
      );
    }, 250);
    timers.current.cap = setTimeout(finish, capSec * 1000);
  }, [kind, capSec, finish]);

  const cancelAsking = () => {
    if (!asking.current) return;
    askId.current++;
    asking.current = false;
    setState("idle");
  };

  const stop = useCallback(() => {
    cancelAsking();
    if (main.current) finish();
  }, [finish]);

  const reset = useCallback(() => {
    askId.current++;
    asking.current = false;
    if (main.current) {
      // Discard an in-flight take without producing a result.
      finishing.current = true;
      clearTimers();
      main.current.recorder.ondataavailable = null;
      if (side.current) side.current.recorder.ondataavailable = null;
      for (const t of [main.current, side.current]) {
        try {
          if (t && t.recorder.state !== "inactive") t.recorder.stop();
        } catch {
          // already stopped
        }
      }
      main.current = null;
      side.current = null;
      releaseStream();
    }
    setStream(null);
    setResult(null);
    setError("");
    setElapsedSec(0);
    setState("idle");
  }, []);

  // A locked or backgrounded page may be suspended and its recorder cut off: stop now, keep the data.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", stop);
    };
  }, [stop]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
      for (const t of [main.current, side.current]) {
        if (!t) continue;
        t.recorder.ondataavailable = null;
        t.recorder.onstop = null;
        try {
          if (t.recorder.state !== "inactive") t.recorder.stop();
        } catch {
          // already stopped
        }
      }
      main.current = null;
      side.current = null;
      releaseStream();
    };
  }, []);

  return { state, error, elapsedSec, stream, result, start, stop, reset };
}
