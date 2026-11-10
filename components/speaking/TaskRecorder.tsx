"use client";

import { Circle, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmTakeAction, deleteTakeAction, generateMaterialAction, startTakeAction } from "@/app/(app)/speaking/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { UploadError, uploadTake } from "@/lib/uploadTake";
import { type RecorderResult, useRecorder } from "@/lib/useRecorder";
import { localDate, takeCapSec } from "@/speaking/schedule";
import type { TaskKey } from "@/speaking/tasks";
import { clock } from "./format";

export type Material = { title?: string; text?: string; prompt?: string; generated: boolean };

type Started = {
  takeId: string;
  uploadUrl: string;
  audioUploadUrl?: string;
  maxBytes: number;
  capSec: number;
  at: number;
  main: boolean;
  audio: boolean;
};
type Save =
  | { phase: "idle" }
  | { phase: "saving"; step: string }
  | { phase: "failed"; error: string }
  | { phase: "saved" };

// Presigned upload URLs live 10 minutes; past this a retry starts a fresh take for new URLs.
const REUSE_MS = 8 * 60 * 1000;
const CLIP_FAILED = "The clip didn't start. Tap Start again.";
const MB = 1024 * 1024;

/** The learner's local calendar date now (YYYY-MM-DD), so a take started before midnight keeps its day. */
function todayHere(fallback: string): string {
  try {
    return localDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return fallback;
  }
}

// Shadowing: one pass of the clip is one take, so recording stops shortly after the clip ends.
const AFTER_CLIP_MS = 1500;

function MaterialView({ task, material }: { task: TaskKey; material: Material }) {
  const body = task === "recordReview" ? material.prompt : material.text;
  return (
    <section aria-label="Practice material" className="grid gap-2 rounded-xl border border-border bg-card p-5">
      {material.title && <h2 className="text-lg font-semibold">{material.title}</h2>}
      {material.generated && <p className="text-xs text-muted-foreground">Written by the AI coach</p>}
      <p className="whitespace-pre-line text-base leading-relaxed">{body}</p>
    </section>
  );
}

/**
 * The recorder for one task: the material on screen, a video toggle, the headphones check for
 * shadowing, then record → upload (retryable) → confirm → transcribe in the background → review.
 */
export function TaskRecorder({
  task,
  date,
  lessonId: initialLessonId,
  material: initialMaterial,
  sourceAudioUrl,
  clipSec,
  videoDefault,
  storage,
}: {
  task: TaskKey;
  date: string;
  lessonId: string | null;
  material: Material | null;
  sourceAudioUrl?: string;
  clipSec?: number;
  videoDefault: boolean;
  storage: boolean;
}) {
  const router = useRouter();
  const [material, setMaterial] = useState(initialMaterial);
  const [lessonId, setLessonId] = useState(initialLessonId);
  const [video, setVideo] = useState(videoDefault);
  const [headphones, setHeadphones] = useState(false);
  const [save, setSave] = useState<Save>({ phase: "idle" });
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [clipError, setClipError] = useState("");

  const kind = video ? "video" : "audio";
  const capSec = takeCapSec(task, clipSec);
  const rec = useRecorder({ kind, capSec });
  const shadowing = task === "shadowing";
  const resetRecorder = rec.reset;

  const audioRef = useRef<HTMLAudioElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const started = useRef<Started | null>(null);
  const savedFor = useRef<RecorderResult | null>(null);
  const clipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clipPlaying = useRef(false);
  const takeDate = useRef(date);

  // Live camera preview while recording video.
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = rec.stream;
  }, [rec.stream]);

  // The clip was primed inside the Start tap (iOS needs the gesture); it plays once recording runs.
  useEffect(() => {
    const audio = audioRef.current;
    if (!shadowing || !audio) return;
    if (rec.state === "recording") {
      if (clipPlaying.current) return;
      clipPlaying.current = true;
      audio.muted = false;
      audio.currentTime = 0;
      void audio.play()?.catch(() => {
        // Without the clip there is nothing to shadow: drop this take rather than save silence.
        clipPlaying.current = false;
        setClipError(CLIP_FAILED);
        resetRecorder();
      });
    } else if (rec.state !== "asking") {
      // Leave the primed clip alone while the permission prompt is open (pausing it aborts the
      // iOS unlock); reset it once recording has finished or failed.
      clipPlaying.current = false;
      audio.pause();
      audio.muted = false;
      audio.currentTime = 0;
      clearTimeout(clipTimer.current);
    }
  }, [rec.state, shadowing, resetRecorder]);

  const unsaved = rec.state === "recording" || (rec.result !== null && save.phase !== "saved");
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const persist = useCallback(
    async (result: RecorderResult) => {
      const fail = (error: string) => setSave({ phase: "failed", error });
      if (result.mime.startsWith("video/") && !result.audioBlob) {
        return fail("The audio track didn't record. Discard this take and record again.");
      }
      setSave({ phase: "saving", step: "Preparing the upload…" });
      try {
        let s = started.current;
        if (s && Date.now() - s.at > REUSE_MS) {
          // Its upload URLs have expired: remove the unconfirmed take before starting a new one.
          const old = s.takeId;
          started.current = s = null;
          await deleteTakeAction(old).catch(() => undefined);
        }
        if (!s) {
          const res = await startTakeAction({
            task,
            date: takeDate.current,
            lessonId,
            material: material ?? { generated: false },
            kind: result.mime.startsWith("video/") ? "video" : "audio",
            mime: result.mime,
            audioMime: result.audioMime,
            clipSec,
          });
          if (!res.ok) return fail(firstError(res.errors) ?? "Couldn't save the recording. Try again.");
          s = started.current = {
            takeId: res.takeId,
            uploadUrl: res.uploadUrl,
            audioUploadUrl: res.audioUploadUrl,
            maxBytes: res.maxBytes,
            capSec: res.capSec,
            at: Date.now(),
            main: false,
            audio: false,
          };
        }
        if (result.blob.size > s.maxBytes) {
          return fail(
            `This recording is larger than the ${Math.floor(s.maxBytes / MB)} MB limit for a take, so it can't be saved. Discard it and record a shorter take.`,
          );
        }
        const two = Boolean(s.audioUploadUrl && result.audioBlob);
        if (!s.main) {
          setSave({ phase: "saving", step: two ? "Uploading the video (1 of 2)…" : "Uploading the recording…" });
          await uploadTake(s.uploadUrl, result.blob, result.mime);
          s.main = true;
        }
        if (two && !s.audio) {
          setSave({ phase: "saving", step: "Uploading the audio (2 of 2)…" });
          await uploadTake(s.audioUploadUrl!, result.audioBlob!, result.audioMime!);
          s.audio = true;
        }
        setSave({
          phase: "saving",
          step:
            result.durationSec > s.capSec
              ? `Saving… (takes are capped at ${clock(s.capSec)}; only that much counts)`
              : "Saving…",
        });
        const confirmed = await confirmTakeAction(s.takeId, result.durationSec);
        if (!confirmed.ok) {
          // The stored objects didn't check out: upload again on retry.
          s.main = false;
          s.audio = false;
          return fail(firstError(confirmed.errors) ?? "Couldn't save the recording. Try again.");
        }
        setSave({ phase: "saved" });
        // Navigate first: the review page starts transcription, so nothing here waits on it.
        router.push(`/speaking/takes/${s.takeId}`);
      } catch (e) {
        fail(e instanceof UploadError ? e.message : "Couldn't save the recording. Check your connection and try again.");
      }
    },
    [task, lessonId, material, clipSec, router],
  );

  useEffect(() => {
    if (!rec.result || savedFor.current === rec.result) return;
    savedFor.current = rec.result;
    started.current = null;
    void persist(rec.result);
  }, [rec.result, persist]);

  function begin() {
    const audio = audioRef.current;
    if (shadowing && audio) {
      // Unlock playback inside this tap with a muted play; the effect above unmutes it and plays
      // from the top once recording starts.
      clipPlaying.current = false;
      audio.muted = true;
      audio.currentTime = 0;
      void audio.play()?.catch(() => {
        audio.muted = false;
      });
    }
    takeDate.current = todayHere(date);
    setClipError("");
    setSave({ phase: "idle" });
    void rec.start();
  }

  function discard() {
    if (!window.confirm("Discard this recording? It hasn't been saved.")) return;
    started.current = null;
    savedFor.current = null;
    setSave({ phase: "idle" });
    rec.reset();
  }

  async function generate() {
    if (task === "shadowing") return;
    setGenerating(true);
    setGenerateError("");
    try {
      const res = await generateMaterialAction(task);
      if (!res.ok) setGenerateError(res.error);
      else {
        setMaterial({ ...res.value, generated: true });
        setLessonId(null);
      }
    } catch {
      setGenerateError("The AI coach failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  if (!storage) {
    return (
      <div className="grid gap-4">
        {material && <MaterialView task={task} material={material} />}
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Recording storage isn&apos;t set up yet, so takes can&apos;t be saved. Ask the site admin to add the R2 storage
          settings.
        </p>
      </div>
    );
  }

  const idle = rec.state === "idle" || rec.state === "error";
  const canStart = idle && material !== null && (!shadowing || headphones) && save.phase === "idle";

  return (
    <div className="grid gap-4">
      {material ? (
        <MaterialView task={task} material={material} />
      ) : (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Today&apos;s lesson has nothing for this task. The AI coach can write some practice material for you.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={generate} disabled={generating}>
              {generating ? "Writing…" : "Generate with AI"}
            </Button>
            {generateError && <Notice>{generateError}</Notice>}
          </div>
        </section>
      )}
      {material?.generated && idle && save.phase === "idle" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
            {generating ? "Writing…" : "Write something else"}
          </Button>
          {generateError && <Notice>{generateError}</Notice>}
        </div>
      )}

      {shadowing && sourceAudioUrl && (
        <audio
          ref={audioRef}
          src={sourceAudioUrl}
          preload="auto"
          playsInline
          onEnded={() => {
            // A primed clip can end during the permission prompt; only a playing pass ends the take.
            if (!clipPlaying.current) return;
            clearTimeout(clipTimer.current);
            clipTimer.current = setTimeout(() => rec.stop(), AFTER_CLIP_MS);
          }}
        />
      )}

      <section aria-label="Recorder" className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={video}
              disabled={!idle || save.phase !== "idle"}
              onChange={(e) => setVideo(e.target.checked)}
              className="size-4"
            />
            Record video
          </label>
          {shadowing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={headphones}
                disabled={!idle}
                onChange={(e) => setHeadphones(e.target.checked)}
                className="size-4"
              />
              I&apos;m wearing headphones
            </label>
          )}
        </div>
        {shadowing && !headphones && idle && (
          <p className="text-xs text-muted-foreground">
            The clip plays while you record, so wear headphones or the microphone picks it up.
          </p>
        )}

        {video && rec.state === "recording" && (
          <video ref={previewRef} autoPlay muted playsInline className="aspect-video w-full max-w-md -scale-x-100 rounded-lg bg-black" />
        )}

        <div className="flex flex-wrap items-center gap-4">
          {rec.state === "recording" || rec.state === "asking" ? (
            <Button variant="destructive" size="lg" onClick={() => rec.stop()}>
              <Square /> Stop
            </Button>
          ) : (
            save.phase === "idle" && (
              <Button size="lg" onClick={begin} disabled={!canStart}>
                <Circle className="fill-current text-destructive" /> {shadowing ? "Start (plays the clip)" : "Start recording"}
              </Button>
            )
          )}
          <span className="font-mono text-sm tabular-nums" aria-live="off">
            {clock(rec.elapsedSec)} / {clock(capSec)}
          </span>
          {rec.state === "asking" && <span className="text-sm text-muted-foreground">Allow the microphone to start…</span>}
          {rec.state === "recording" && (
            <span className="flex items-center gap-2 text-sm text-destructive">
              <span className="size-2 animate-pulse rounded-full bg-destructive" /> Recording
            </span>
          )}
        </div>
        {rec.state === "error" && <Notice>{rec.error}</Notice>}
        {clipError && <Notice>{clipError}</Notice>}

        {save.phase === "saving" && (
          <div className="grid gap-1.5" role="status">
            <span className="text-sm">{save.step}</span>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-ring" />
            </div>
          </div>
        )}
        {save.phase === "failed" && (
          <div className="grid gap-3">
            <Notice>{save.error}</Notice>
            <p className="text-xs text-muted-foreground">Your recording is kept on this page until it saves.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => rec.result && void persist(rec.result)}>Try again</Button>
              <Button variant="outline" onClick={discard}>
                Discard
              </Button>
            </div>
          </div>
        )}
        {save.phase === "saved" && <Notice tone="ok">Saved. Opening the review…</Notice>}
      </section>
    </div>
  );
}
