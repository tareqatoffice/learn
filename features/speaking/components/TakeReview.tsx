"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteTakeAction, takeMediaUrlsAction, transcribeTakeAction } from "@/app/(app)/speaking/actions";
import { firstError } from "@/features/admin/result";
import { confirm } from "@/components/ConfirmDialog";
import { MediaPlayer } from "@/components/MediaPlayer";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import type { TakeView } from "@/features/speaking/takes";
import { CoachPanel, type CoachAi } from "./CoachPanel";
import { SelfRatingForm, type SelfRating } from "./SelfRatingForm";
import { ShadowPlayer } from "./ShadowPlayer";
import { ShadowText } from "./ShadowText";
import { sentenceAt, timeline } from "@/features/speaking/shadowText";
import { Card } from "@/components/Card";

const REFRESH_MS = 8 * 60 * 1000;

export function TakeTranscript({ takeId, status, transcript }: { takeId: string; status: string; transcript?: string }) {
  const router = useRouter();
  const [text, setText] = useState(transcript);
  const [state, setState] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedFor = useRef<string | null>(null);

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
  } else if (state === "running" && !busy) {
    body = (
      <div className="grid gap-2">
        <p role="status" className="text-sm text-muted-foreground">
          This recording is being transcribed (perhaps in another tab). Reload in a minute to see it.
        </p>
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => router.refresh()}>
          Check again
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
    <Card as="section" aria-labelledby="transcript" className="grid gap-2">
      <h2 id="transcript" className="font-semibold">
        Transcript
      </h2>
      {body}
      {error && <Notice>{error}</Notice>}
    </Card>
  );
}

export function TakeReview({ take, aiOn, bodyConsent }: { take: TakeView; aiOn: boolean; bodyConsent: boolean }) {
  const router = useRouter();
  const player = useRef<HTMLMediaElement | null>(null);
  const [self, setSelf] = useState<SelfRating | undefined>(take.self);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [urls] = useState({ media: take.mediaUrl, audio: take.audioUrl, source: take.sourceAudioUrl });
  const [compareUrl, setCompareUrl] = useState(take.audioUrl ?? take.mediaUrl);
  useEffect(() => {
    if (take.task !== "shadowing" || !take.sourceAudioUrl) return;
    const timer = setInterval(async () => {
      const fresh = await takeMediaUrlsAction(take.id).catch(() => null);
      if (fresh) setCompareUrl(fresh.audio ?? fresh.media);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [take.id, take.task, take.sourceAudioUrl]);
  const video = take.kind === "video";
  const reference = take.task === "recordReview" ? take.material.prompt : take.material.text;
  const [sourceTime, setSourceTime] = useState<number | null>(null);
  const sentences = useMemo(
    () => (take.task === "shadowing" && reference ? timeline(reference, take.sourceDurationSec ?? 0, take.sourceMarks) : []),
    [take.task, reference, take.sourceDurationSec, take.sourceMarks],
  );

  async function remove() {
    if (
      !(await confirm({
        description: "Delete this recording? The video or audio and its ratings are removed for good.",
        destructive: true,
      }))
    ) {
      return;
    }
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
        <Card as="section" aria-label="Playback" className="grid gap-3">
          <MediaPlayer
            src={urls.media}
            video={video}
            fallbackDuration={take.durationSec}
            refreshSrc={async () => (await takeMediaUrlsAction(take.id))?.media ?? null}
            label="your take"
            playerRef={(el) => {
              player.current = el;
            }}
          />
          {take.task === "shadowing" && urls.source && (
            <ShadowPlayer sourceUrl={urls.source} takeUrl={compareUrl} rate={take.clipRate} onSourceTime={setSourceTime} />
          )}
        </Card>

        <TakeTranscript takeId={take.id} status={take.transcriptStatus} transcript={take.transcript} />

        {sentences.length > 0 && take.sourceDurationSec ? (
          <Card as="section" aria-labelledby="practised" className="grid gap-2">
            <h2 id="practised" className="font-semibold">
              The text you practised
            </h2>
            <ShadowText sentences={sentences} active={sourceTime === null ? -1 : sentenceAt(sentences, sourceTime)} />
          </Card>
        ) : reference && (
          <Card as="details">
            <summary className="cursor-pointer font-semibold">
              {take.task === "recordReview" ? "The prompt" : "The text you practised"}
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{reference}</p>
          </Card>
        )}
      </div>

      <div className="grid content-start gap-4">
        <Card as="section" aria-labelledby="self-rating" className="grid gap-3">
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
        </Card>

        <Card as="section" aria-labelledby="coach" className="grid gap-3">
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
        </Card>

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
