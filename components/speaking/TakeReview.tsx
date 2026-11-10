"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteTakeAction, transcribeTakeAction } from "@/app/(app)/speaking/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import type { TakeView } from "@/speaking/takes";
import { CoachPanel, type CoachAi } from "./CoachPanel";
import { SelfRatingForm, type SelfRating } from "./SelfRatingForm";
import { ShadowPlayer } from "./ShadowPlayer";

/**
 * The take's transcript and its status. A freshly saved take arrives "pending": this starts the
 * transcription once, here rather than in the recorder, so navigating to this page never waits on it.
 */
export function TakeTranscript({ takeId, status, transcript }: { takeId: string; status: string; transcript?: string }) {
  const router = useRouter();
  const [text, setText] = useState(transcript);
  const [state, setState] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedFor = useRef<string | null>(null);

  // A refresh brings the server's latest status down as props.
  const [shown, setShown] = useState({ status, transcript });
  if (shown.status !== status || shown.transcript !== transcript) {
    setShown({ status, transcript });
    setState(status);
    setText(transcript);
  }

  const run = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await transcribeTakeAction(takeId);
      if (res.ok) {
        setText(res.transcript);
        setState("done");
      } else {
        setError(firstError(res.errors) ?? "Couldn't transcribe the recording. Try again.");
        setState("failed");
      }
    } catch {
      setError("Couldn't transcribe the recording. Try again.");
      setState("failed");
    } finally {
      setBusy(false);
      // Bring down the stored status (and let the coach see the transcript).
      router.refresh();
    }
  }, [takeId, router]);

  useEffect(() => {
    if (status !== "pending" || startedFor.current === takeId) return;
    startedFor.current = takeId;
    void run();
  }, [status, takeId, run]);

  let body: React.ReactNode;
  if (state === "done" && text?.trim()) {
    body = <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>;
  } else if (state === "done") {
    body = <p className="text-sm text-muted-foreground">No speech was heard in this recording.</p>;
  } else if (state === "pending") {
    body = busy ? (
      <p role="status" className="text-sm text-muted-foreground">
        Transcribing your recording… this usually takes under a minute.
      </p>
    ) : (
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">This recording hasn&apos;t been transcribed yet.</p>
        <Button variant="outline" size="sm" className="justify-self-start" onClick={run}>
          Transcribe now
        </Button>
      </div>
    );
  } else if (state === "failed") {
    body = (
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">The transcript couldn&apos;t be made.</p>
        <Button variant="outline" size="sm" className="justify-self-start" onClick={run} disabled={busy}>
          {busy ? "Transcribing…" : "Try again"}
        </Button>
      </div>
    );
  } else if (state === "unavailable") {
    body = (
      <p className="text-sm text-muted-foreground">
        Transcripts aren&apos;t set up on this site (speech-to-text isn&apos;t configured), so this recording has none.
        You can still rate it yourself; AI speech feedback needs a transcript.
      </p>
    );
  } else {
    body = <p className="text-sm text-muted-foreground">This recording has no transcript.</p>;
  }

  return (
    <section aria-labelledby="transcript" className="grid gap-2 rounded-xl border border-border bg-card p-5">
      <h2 id="transcript" className="font-semibold">
        Transcript
      </h2>
      {body}
      {error && <Notice>{error}</Notice>}
    </section>
  );
}

/** One take: playback, transcript, self-rating, then AI feedback, and delete. */
export function TakeReview({ take, aiOn, bodyConsent }: { take: TakeView; aiOn: boolean; bodyConsent: boolean }) {
  const router = useRouter();
  const player = useRef<HTMLMediaElement | null>(null);
  const [self, setSelf] = useState<SelfRating | undefined>(take.self);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Refreshes (after transcription) bring new presigned URLs; keep the first so playback isn't reset.
  const [urls] = useState({ media: take.mediaUrl, audio: take.audioUrl, source: take.sourceAudioUrl });
  const video = take.kind === "video";
  const reference = take.task === "recordReview" ? take.material.prompt : take.material.text;

  async function remove() {
    if (!window.confirm("Delete this recording? The video or audio and its ratings are removed for good.")) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await deleteTakeAction(take.id);
      if (!res.ok) return setDeleteError(firstError(res.errors) ?? "Couldn't delete the recording. Try again.");
      router.push("/speaking/history");
    } catch {
      setDeleteError("Couldn't delete the recording. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  const seek = (sec: number) => {
    const el = player.current;
    if (!el) return;
    el.currentTime = sec;
    void el.play()?.catch(() => {});
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-4">
        <section aria-label="Playback" className="grid gap-3 rounded-xl border border-border bg-card p-5">
          {video ? (
            <video
              ref={(el) => {
                player.current = el;
              }}
              src={urls.media}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-lg bg-black"
            />
          ) : (
            <audio
              ref={(el) => {
                player.current = el;
              }}
              src={urls.media}
              controls
              preload="metadata"
              className="w-full"
            />
          )}
          {take.task === "shadowing" && urls.source && (
            <ShadowPlayer sourceUrl={urls.source} takeUrl={urls.audio ?? urls.media} />
          )}
        </section>

        <TakeTranscript takeId={take.id} status={take.transcriptStatus} transcript={take.transcript} />

        {reference && (
          <details className="rounded-xl border border-border bg-card p-5">
            <summary className="cursor-pointer font-semibold">
              {take.task === "recordReview" ? "The prompt" : "The text you practised"}
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{reference}</p>
          </details>
        )}
      </div>

      <div className="grid content-start gap-4">
        <section aria-labelledby="self-rating" className="grid gap-3 rounded-xl border border-border bg-card p-5">
          <h2 id="self-rating" className="font-semibold">
            Rate yourself
          </h2>
          <SelfRatingForm
            takeId={take.id}
            kind={take.kind}
            durationSec={take.durationSec}
            currentTime={() => player.current?.currentTime ?? 0}
            initial={take.self}
            initialMarkers={take.markers}
            onSaved={setSelf}
            onSeek={seek}
          />
        </section>

        <section aria-labelledby="coach" className="grid gap-3 rounded-xl border border-border bg-card p-5">
          <h2 id="coach" className="font-semibold">
            AI coach
          </h2>
          <CoachPanel
            takeId={take.id}
            kind={take.kind}
            mediaUrl={urls.media}
            self={self}
            transcriptReady={take.transcriptStatus === "done" && Boolean(take.transcript?.trim())}
            aiOn={aiOn}
            bodyConsent={bodyConsent}
            initialAi={take.ai as CoachAi | undefined}
          />
        </section>

        <div className="grid gap-2">
          <Button variant="destructive" className="justify-self-start" onClick={remove} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete recording"}
          </Button>
          {deleteError && <Notice>{deleteError}</Notice>}
        </div>
      </div>
    </div>
  );
}
