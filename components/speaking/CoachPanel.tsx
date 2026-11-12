"use client";

import { useState } from "react";
import { bodyFeedbackAction, setBodyConsentAction, speechFeedbackAction } from "@/app/(app)/speaking/actions";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { framesOf } from "@/lib/media";
import type { BodyFeedback, SpeechFeedback } from "@/speaking/coach";
import { BodyConsentDialog } from "./BodyConsentDialog";
import type { SelfRating } from "./SelfRatingForm";

export type CoachAi = { speech?: Partial<SpeechFeedback>; body?: Partial<BodyFeedback> };

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
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

/** Self vs AI, criterion by criterion; a dash where one side has no score. */
function Scores({ self, ai, video }: { self?: SelfRating; ai: CoachAi; video: boolean }) {
  const rows: [string, number | undefined, number | undefined][] = [
    ["Fluency", self?.fluency, ai.speech?.fluency],
    ["Confidence", self?.confidence, ai.body?.confidence],
    ...(video
      ? ([
          ["Eye contact", self?.eyeContact, ai.body?.eyeContact],
          ["Gestures", self?.gestures, ai.body?.gestures],
        ] as [string, number | undefined, number | undefined][])
      : []),
    ["Vocabulary", undefined, ai.speech?.vocabulary],
    ["Grammar", undefined, ai.speech?.grammar],
  ];
  const cell = (n?: number) => (typeof n === "number" ? `${n}/5` : "–");
  return (
    <table className="w-full max-w-sm text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-1 font-medium">Criterion</th>
          <th className="py-1 font-medium">You</th>
          <th className="py-1 font-medium">AI coach</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map(([label, mine, theirs]) => (
          <tr key={label} className="border-t border-border">
            <td className="py-1.5">{label}</td>
            <td className="py-1.5">{cell(mine)}</td>
            <td className="py-1.5">{cell(theirs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * AI feedback on a take, after the learner's own rating: speech from the transcript, and for video
 * body language from a few stills (after a one-time consent).
 */
export function CoachPanel({
  takeId,
  kind,
  mediaUrl,
  self,
  transcriptReady,
  aiOn,
  bodyConsent: initialConsent,
  initialAi,
}: {
  takeId: string;
  kind: "audio" | "video";
  mediaUrl: string;
  self?: SelfRating;
  transcriptReady: boolean;
  aiOn: boolean;
  bodyConsent: boolean;
  initialAi?: CoachAi;
}) {
  const [ai, setAi] = useState<CoachAi>(initialAi ?? {});
  const [consent, setConsent] = useState(initialConsent);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<"speech" | "body" | "consent" | null>(null);
  const [error, setError] = useState("");
  const video = kind === "video";
  const rated = Boolean(self?.fluency);

  async function speech() {
    setBusy("speech");
    setError("");
    try {
      const res = await speechFeedbackAction(takeId);
      if (res.ok) setAi((a) => ({ ...a, speech: res.value }));
      else setError(res.error);
    } catch {
      setError("The AI coach failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function body() {
    setBusy("body");
    setError("");
    try {
      let frames: string[];
      try {
        frames = await framesOf(mediaUrl);
      } catch {
        return setError("Couldn't read stills from the video. Reload the page and try again.");
      }
      if (!frames.length) return setError("Couldn't read stills from the video. Reload the page and try again.");
      const res = await bodyFeedbackAction(takeId, frames);
      if (res.ok) setAi((a) => ({ ...a, body: res.value }));
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
    await body();
  }

  return (
    <div className="grid gap-4">
      <Scores self={self} ai={ai} video={video} />

      {!aiOn ? (
        <p className="text-sm text-muted-foreground">The AI coach is turned off.</p>
      ) : !rated ? (
        <p className="text-sm text-muted-foreground">Rate yourself first, then ask the AI coach.</p>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={speech} disabled={busy !== null || !transcriptReady}>
              {busy === "speech" ? "Asking the coach…" : ai.speech ? "Speech feedback again" : "Speech feedback"}
            </Button>
            {video && (
              <Button
                variant="outline"
                onClick={() => (consent ? body() : setAsking(true))}
                disabled={busy !== null}
              >
                {busy === "body" ? "Looking at the video…" : "Body language feedback"}
              </Button>
            )}
          </div>
          {!transcriptReady && (
            <p className="text-xs text-muted-foreground">Speech feedback needs the transcript.</p>
          )}
          <p className="text-xs text-muted-foreground">Each request counts towards your daily AI limit.</p>
        </div>
      )}
      {error && <Notice>{error}</Notice>}

      {ai.speech && (
        <section aria-label="Speech feedback" className="grid gap-3 rounded-lg border border-border p-4">
          <h3 className="font-semibold">Speech</h3>
          {ai.speech.summary && <p className="text-sm">{ai.speech.summary}</p>}
          <List title="Strengths" items={ai.speech.strengths} />
          <List title="Work on" items={ai.speech.workOn} />
          <List title="Missed or changed words" items={ai.speech.missedWords} />
        </section>
      )}
      {ai.body && (
        <section aria-label="Body language feedback" className="grid gap-3 rounded-lg border border-border p-4">
          <h3 className="font-semibold">Body language</h3>
          <List title="Suggestions" items={ai.body.suggestions} />
        </section>
      )}

      {video && (
        <BodyConsentDialog
          open={asking}
          pending={busy === "consent"}
          onAgree={agree}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}
