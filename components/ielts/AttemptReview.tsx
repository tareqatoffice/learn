"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  aiEstimateAction,
  attemptBodyFeedbackAction,
  deleteAttemptAction,
  setBodyConsentAction,
  transcribePartAction,
} from "@/app/(app)/ielts/speaking/actions";
import { firstError } from "@/admin/result";
import { MediaPlayer } from "@/components/MediaPlayer";
import { Notice } from "@/components/Notice";
import { BodyConsentDialog } from "@/components/speaking/BodyConsentDialog";
import { clock } from "@/components/speaking/format";
import { Button } from "@/components/ui/button";
import { CRITERIA, CRITERION_LABEL, type Criterion } from "@/ielts/bands";
import type { AttemptView, PartView } from "@/ielts/speaking/attempts";
import type { AiEstimate } from "@/ielts/speaking/score";
import { KIND_PARTS, type Part } from "@/ielts/speaking/timing";
import { framesOf } from "@/lib/media";
import type { BodyFeedback } from "@/speaking/coach";
import { BandCompare } from "./BandCompare";
import { SelfBandsForm, type SelfBands } from "./SelfBandsForm";

const PART_NAME: Record<Part, string> = { p1: "Part 1", p2: "Part 2", p3: "Part 3" };
export const KIND_NAME = { mock: "Full mock", part1: "Part 1 drill", part2: "Part 2 drill", part3: "Part 3 drill" } as const;

const card = "grid gap-3 rounded-xl border border-border bg-card p-5";
const DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/** A saved self-rating has a number for every criterion. */
function asSelf(raw: Record<string, unknown> | undefined): SelfBands | null {
  if (!raw || !CRITERIA.every((c) => typeof raw[c] === "number")) return null;
  return raw as SelfBands;
}

type TranscriptState = { status: string; text?: string };

/**
 * One part's transcript. The runner starts transcription in the background after each part is stored. If a
 * part is still "pending" when this page opens (that request didn't finish or failed), this starts it once;
 * a repeat for a part that is already done is refused or refunded server-side.
 */
function PartTranscript({
  attemptId,
  part,
  initial,
  onChange,
}: {
  attemptId: string;
  part: Part;
  initial: TranscriptState;
  onChange: (part: Part, state: TranscriptState) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  const update = useCallback(
    (next: TranscriptState) => {
      setState(next);
      onChange(part, next);
    },
    [onChange, part],
  );

  const run = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await transcribePartAction(attemptId, part);
      if (res.ok) update({ status: "done", text: res.transcript });
      else {
        setError(firstError(res.errors) ?? "Couldn't transcribe the recording. Try again.");
        update({ status: "failed" });
      }
    } catch {
      setError("Couldn't transcribe the recording. Try again.");
      update({ status: "failed" });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }, [attemptId, part, router, update]);

  useEffect(() => {
    if (initial.status !== "pending" || started.current) return;
    started.current = true;
    void run();
  }, [initial.status, run]);

  let body: React.ReactNode;
  if (state.status === "done" && state.text?.trim()) {
    body = <p className="whitespace-pre-line text-sm leading-relaxed">{state.text}</p>;
  } else if (state.status === "done") {
    body = <p className="text-sm text-muted-foreground">No speech was heard in this recording.</p>;
  } else if (state.status === "pending") {
    body = busy ? (
      <p role="status" className="text-sm text-muted-foreground">
        Transcribing your recording… this usually takes under a minute.
      </p>
    ) : (
      <Button variant="outline" size="sm" className="justify-self-start" onClick={run}>
        Transcribe now
      </Button>
    );
  } else if (state.status === "failed") {
    body = (
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">The transcript couldn&apos;t be made.</p>
        <Button variant="outline" size="sm" className="justify-self-start" onClick={run} disabled={busy}>
          {busy ? "Transcribing…" : "Try again"}
        </Button>
      </div>
    );
  } else if (state.status === "unavailable") {
    body = (
      <p className="text-sm text-muted-foreground">
        Transcripts aren&apos;t set up on this site, so this recording has none. You can still rate it yourself; the AI estimate needs a
        transcript.
      </p>
    );
  } else {
    body = <p className="text-sm text-muted-foreground">This recording has no transcript.</p>;
  }
  return (
    <div className="grid gap-1.5">
      <h4 className="text-sm font-medium">Transcript</h4>
      {body}
      {error && <Notice>{error}</Notice>}
    </div>
  );
}

function PartCard({
  attemptId,
  view,
  url,
  onTranscript,
}: {
  attemptId: string;
  view: PartView;
  url: string;
  onTranscript: (part: Part, state: TranscriptState) => void;
}) {
  const player = useRef<HTMLMediaElement | null>(null);
  const seek = (sec: number) => {
    const el = player.current;
    if (!el) return;
    el.currentTime = sec;
    void el.play()?.catch(() => {});
  };
  return (
    <section aria-label={`${PART_NAME[view.part]} playback`} className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{PART_NAME[view.part]}</h3>
        <span className="text-xs text-muted-foreground">
          {clock(view.durationSec)} · {view.kind === "video" ? "video" : "audio"}
        </span>
      </div>
      <MediaPlayer
        src={url}
        video={view.kind === "video"}
        label={`${PART_NAME[view.part]} recording`}
        playerRef={(el) => {
          player.current = el;
        }}
      />
      {view.markers.length > 0 && (
        <ul aria-label="Marked moments" className="flex flex-wrap gap-2">
          {view.markers.map((m, i) => (
            <li key={`${m.atSec}-${i}`}>
              <button
                type="button"
                onClick={() => seek(m.atSec)}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:py-2.5"
              >
                <span className="tabular-nums">{clock(m.atSec)}</span> {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <PartTranscript
        attemptId={attemptId}
        part={view.part}
        initial={{ status: view.transcriptStatus, text: view.transcript }}
        onChange={onTranscript}
      />
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="list-disc space-y-0.5 pl-5 text-sm">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function EstimateDetails({ ai }: { ai: AiEstimate }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        {CRITERIA.map((c: Criterion) => (
          <div key={c} className="grid gap-1">
            <h4 className="text-sm font-medium">{CRITERION_LABEL[c]}</h4>
            <p className="text-sm">{ai.reasons?.[c]}</p>
            {(ai.evidence?.[c] ?? []).map((q, i) => (
              <blockquote key={i} className="border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
                {q}
              </blockquote>
            ))}
          </div>
        ))}
      </div>
      <List title="Strengths" items={ai.strengths ?? []} />
      {(ai.nextBand ?? []).length > 0 && (
        <div className="grid gap-2">
          <h4 className="text-sm font-medium">To reach the next band</h4>
          <ul className="grid gap-3">
            {ai.nextBand.map((n, i) => (
              <li key={i} className="grid gap-1 rounded-lg border border-border p-3 text-sm">
                <p>{n.advice}</p>
                {n.original && <p className="text-muted-foreground">You said: {n.original}</p>}
                {n.rewrite && <p>Try: {n.rewrite}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type BusyKind = "estimate" | "body" | "consent" | null;

/**
 * One attempt, in a fixed order: playback with transcripts, your own bands, then the AI estimate.
 * The AI section stays hidden until your bands are saved.
 */
export function AttemptReview({ attempt, aiOn, bodyConsent: initialConsent }: { attempt: AttemptView; aiOn: boolean; bodyConsent: boolean }) {
  const router = useRouter();
  const stored = KIND_PARTS[attempt.kind].flatMap((p) => attempt.parts.filter((v) => v.part === p && v.stored && v.mediaUrl));
  // Refreshes (after transcription) bring new presigned URLs; keep the first so playback isn't reset.
  const [urls] = useState(() => Object.fromEntries(stored.map((v) => [v.part, v.mediaUrl!])) as Partial<Record<Part, string>>);
  const [transcripts, setTranscripts] = useState<Partial<Record<Part, TranscriptState>>>(() =>
    Object.fromEntries(stored.map((v) => [v.part, { status: v.transcriptStatus, text: v.transcript }])),
  );
  const [self, setSelf] = useState<SelfBands | null>(() => asSelf(attempt.self));
  const [ai, setAi] = useState<AiEstimate | null>(() => (attempt.ai && typeof attempt.ai.overall === "number" ? (attempt.ai as unknown as AiEstimate) : null));
  const [body, setBody] = useState<BodyFeedback | null>(() => (attempt.body as unknown as BodyFeedback) ?? null);
  const [consent, setConsent] = useState(initialConsent);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const onTranscript = useCallback((part: Part, state: TranscriptState) => setTranscripts((t) => ({ ...t, [part]: state })), []);

  const video = stored.some((v) => v.kind === "video");
  const p2Video = stored.find((v) => v.part === "p2" && v.kind === "video");
  const transcriptsDone = stored.length > 0 && stored.every((v) => transcripts[v.part]?.status === "done");
  const incomplete = attempt.status === "incomplete";

  async function estimate() {
    setBusy("estimate");
    setError("");
    try {
      const res = await aiEstimateAction(attempt.id);
      if (res.ok) setAi(res.value);
      else setError(res.error);
    } catch {
      setError("The AI estimate failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function bodyFeedback() {
    setBusy("body");
    setError("");
    try {
      let frames: string[];
      try {
        frames = await framesOf(urls.p2!);
      } catch {
        return setError("Couldn't read stills from the video. Reload the page and try again.");
      }
      if (!frames.length) return setError("Couldn't read stills from the video. Reload the page and try again.");
      const res = await attemptBodyFeedbackAction(attempt.id, frames);
      if (res.ok) setBody(res.value);
      else setError(res.error);
    } catch {
      setError("The AI coach failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function agree() {
    setBusy("consent");
    try {
      const res = await setBodyConsentAction(true);
      if (!res.ok) {
        setBusy(null);
        return setError("Couldn't save your choice. Try again.");
      }
      setConsent(true);
      setAsking(false);
    } catch {
      setBusy(null);
      return setError("Couldn't save your choice. Try again.");
    }
    await bodyFeedback();
  }

  async function remove() {
    if (!window.confirm("Delete this attempt? Its recordings, ratings and band entries are removed for good.")) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await deleteAttemptAction(attempt.id);
      if (!res.ok) return setDeleteError(firstError(res.errors) ?? "Couldn't delete the attempt. Try again.");
      router.push("/ielts/speaking");
    } catch {
      setDeleteError("Couldn't delete the attempt. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{KIND_NAME[attempt.kind]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {DATE.format(new Date(`${attempt.date}T00:00:00Z`))}
          {attempt.paused && " · paused during the run"}
        </p>
      </div>

      {incomplete && (
        <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">
          This attempt is incomplete: only the parts below were stored. You can rate what is here, or delete the attempt.
        </p>
      )}
      {attempt.notes && (
        <section aria-labelledby="notes" className={card}>
          <h2 id="notes" className="font-semibold">
            Your Part 2 notes
          </h2>
          <p className="whitespace-pre-line text-sm">{attempt.notes}</p>
        </section>
      )}

      {stored.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No part of this attempt was stored, so there is nothing to play or rate.
        </p>
      ) : (
        <>
          <div className="grid gap-4">
            {stored.map((v) => (
              <PartCard key={v.part} attemptId={attempt.id} view={v} url={urls[v.part]!} onTranscript={onTranscript} />
            ))}
          </div>

          <section aria-labelledby="self-bands" className={card}>
            <h2 id="self-bands" className="font-semibold">
              Rate yourself
            </h2>
            <p className="text-sm text-muted-foreground">Rate each criterion before you see the AI estimate. Whole bands, 1 to 9.</p>
            <SelfBandsForm attemptId={attempt.id} video={video} initial={self ?? undefined} onSaved={setSelf} />
          </section>

          {self && (
            <section aria-labelledby="ai-estimate" className={card}>
              <h2 id="ai-estimate" className="font-semibold">
                AI estimate
              </h2>
              {!aiOn ? (
                <p className="text-sm text-muted-foreground">The AI coach is turned off.</p>
              ) : (
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={estimate} disabled={busy !== null || !transcriptsDone}>
                      {busy === "estimate" ? "Estimating…" : ai ? "Estimate again" : "Get AI estimate"}
                    </Button>
                    {p2Video && (
                      <Button variant="outline" onClick={() => (consent ? bodyFeedback() : setAsking(true))} disabled={busy !== null}>
                        {busy === "body" ? "Looking at the video…" : "Body language feedback"}
                      </Button>
                    )}
                  </div>
                  {!transcriptsDone && <p className="text-xs text-muted-foreground">The estimate needs every transcript to be ready.</p>}
                  <p className="text-xs text-muted-foreground">Each request counts towards your daily AI limit.</p>
                </div>
              )}
              {error && <Notice>{error}</Notice>}
              {ai && (
                <>
                  <BandCompare self={self as Record<Criterion, number>} ai={ai} />
                  <EstimateDetails ai={ai} />
                </>
              )}
              {body && (
                <div aria-label="Body language feedback" className="grid gap-2 rounded-lg border border-border p-4">
                  <h3 className="font-semibold">Body language</h3>
                  <p className="text-sm tabular-nums">
                    Confidence {body.confidence}/5 · Eye contact {body.eyeContact}/5 · Gestures {body.gestures}/5{" "}
                    <span className="text-xs text-muted-foreground">estimate</span>
                  </p>
                  <List title="Suggestions" items={body.suggestions ?? []} />
                </div>
              )}
            </section>
          )}
        </>
      )}

      <div className="grid gap-2">
        <Button variant="destructive" className="justify-self-start" onClick={remove} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete attempt"}
        </Button>
        {deleteError && <Notice>{deleteError}</Notice>}
      </div>

      {p2Video && <BodyConsentDialog open={asking} pending={busy === "consent"} onAgree={agree} onCancel={() => setAsking(false)} />}
    </div>
  );
}
