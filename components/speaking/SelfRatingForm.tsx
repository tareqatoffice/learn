"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { saveSelfRatingAction } from "@/app/(app)/speaking/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clock } from "./format";

export type SelfRating = { fluency?: number; confidence?: number; eyeContact?: number; gestures?: number; note?: string };
export type Marker = { atSec: number; label: string };

const SCORES = [1, 2, 3, 4, 5];
const NOTE_MAX = 1000;
const LABEL_MAX = 60;

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function ScoreGroup({
  name,
  label,
  hint,
  value,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  value?: number;
  onChange: (n: number) => void;
}) {
  const id = `rate-${name}`;
  return (
    <div role="radiogroup" aria-labelledby={id} className="grid gap-1.5">
      <span id={id} className="text-sm font-medium">
        {label} <span className="font-normal text-muted-foreground">· {hint}</span>
      </span>
      <div className="flex gap-1.5">
        {SCORES.map((n) => (
          <label
            key={n}
            className={cn(
              "grid size-9 cursor-pointer place-items-center rounded-lg border text-sm tabular-nums transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring pointer-coarse:size-11",
              value === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-label={`${label} ${n}`}
              className="sr-only"
            />
            {n}
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * The learner's own 1–5 rating of a take, before any AI feedback: fluency and confidence always,
 * eye contact and gestures for video, a note, and moments marked at the player's current time.
 */
export function SelfRatingForm({
  takeId,
  kind,
  durationSec,
  currentTime,
  initial,
  initialMarkers = [],
  onSaved,
  onSeek,
}: {
  takeId: string;
  kind: "audio" | "video";
  durationSec: number;
  currentTime: () => number;
  initial?: SelfRating;
  initialMarkers?: Marker[];
  onSaved: (self: SelfRating) => void;
  onSeek?: (sec: number) => void;
}) {
  const [rating, setRating] = useState<SelfRating>(initial ?? {});
  const [note, setNote] = useState(initial?.note ?? "");
  const [markers, setMarkers] = useState<Marker[]>(initialMarkers);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const video = kind === "video";

  const set = (key: keyof SelfRating) => (n: number) => {
    setRating((r) => ({ ...r, [key]: n }));
    setMessage(null);
  };

  function mark() {
    const at = Math.round(Math.min(Math.max(0, currentTime() || 0), durationSec) * 10) / 10;
    setMarkers((list) => [...list, { atSec: at, label: "" }].sort((a, b) => a.atSec - b.atSec));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating.fluency) return setMessage({ tone: "error", text: "Rate your fluency first" });
    if (!rating.confidence) return setMessage({ tone: "error", text: "Rate your confidence first" });
    if (markers.some((m) => !m.label.trim())) {
      return setMessage({ tone: "error", text: "Give each marked moment a short label" });
    }
    const input = {
      fluency: rating.fluency,
      confidence: rating.confidence,
      ...(video && rating.eyeContact ? { eyeContact: rating.eyeContact } : {}),
      ...(video && rating.gestures ? { gestures: rating.gestures } : {}),
      note: note.trim(),
      markers: markers.map((m) => ({ atSec: m.atSec, label: m.label.trim() })),
    };
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await saveSelfRatingAction(takeId, input);
        if (!res.ok) return setMessage({ tone: "error", text: firstError(res.errors) ?? "Couldn't save. Try again." });
        setMessage({ tone: "ok", text: "Rating saved." });
        onSaved({ ...input, note: input.note || undefined });
      } catch {
        setMessage({ tone: "error", text: "Couldn't save. Try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <ScoreGroup name="fluency" label="Fluency" hint="smooth, few pauses" value={rating.fluency} onChange={set("fluency")} />
      <ScoreGroup name="confidence" label="Confidence" hint="how sure you sounded" value={rating.confidence} onChange={set("confidence")} />
      {video && (
        <>
          <ScoreGroup name="eyeContact" label="Eye contact" hint="looking at the camera" value={rating.eyeContact} onChange={set("eyeContact")} />
          <ScoreGroup name="gestures" label="Gestures" hint="posture and hands" value={rating.gestures} onChange={set("gestures")} />
        </>
      )}

      <div className="grid gap-1.5">
        <label htmlFor="self-note" className="text-sm font-medium">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="self-note"
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={fieldClass}
          placeholder="What to do differently next time"
        />
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Moments</span>
          <Button type="button" variant="outline" size="sm" onClick={mark}>
            Mark this moment
          </Button>
        </div>
        {markers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Pause where something stood out (filler words, looked down) and mark it.
          </p>
        ) : (
          <ul className="grid gap-2">
            {markers.map((m, i) => (
              <li key={`${m.atSec}-${i}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSeek?.(m.atSec)}
                  className="shrink-0 rounded-md px-1.5 py-1 font-mono text-xs tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Play from ${clock(m.atSec)}`}
                >
                  {clock(m.atSec)}
                </button>
                <input
                  value={m.label}
                  maxLength={LABEL_MAX}
                  aria-label={`Label for the moment at ${clock(m.atSec)}`}
                  placeholder="e.g. filler words"
                  onChange={(e) =>
                    setMarkers((list) => list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                  className={fieldClass}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove the moment at ${clock(m.atSec)}`}
                  onClick={() => setMarkers((list) => list.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save rating"}
        </Button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </form>
  );
}
