"use client";

import { useState, useTransition } from "react";
import { saveSelfBandsAction } from "@/app/(app)/ielts/speaking/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { CRITERIA, CRITERION_LABEL, type Criterion, speakingBand } from "@/ielts/bands";

/** The learner's saved rating: whole bands per criterion, plus optional 1-5 body-language scores. */
export type SelfBands = Record<Criterion, number> & {
  notes?: string;
  confidence?: number;
  eyeContact?: number;
  gestures?: number;
};

const BANDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SCORES = [1, 2, 3, 4, 5];
const NOTES_MAX = 2000;
const EXTRAS = [
  { key: "confidence", label: "Confidence", hint: "how sure you sounded" },
  { key: "eyeContact", label: "Eye contact", hint: "looking at the camera" },
  { key: "gestures", label: "Gestures", hint: "posture and hands" },
] as const;

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:py-3";

function Choice({
  id,
  label,
  hint,
  options,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  options: number[];
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label} {hint && <span className="font-normal text-muted-foreground">· {hint}</span>}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} aria-invalid={error ? true : undefined}>
        <option value="">Choose…</option>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * The learner's own rating, before any AI estimate: a whole band 1-9 for each of the four criteria,
 * a note, and 1-5 scores for confidence, eye contact and gestures when the recording has video.
 */
export function SelfBandsForm({
  attemptId,
  video,
  initial,
  onSaved,
}: {
  attemptId: string;
  video: boolean;
  initial?: Partial<SelfBands>;
  onSaved: (self: SelfBands) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries([...CRITERIA, ...EXTRAS.map((e) => e.key)].map((k) => [k, initial?.[k] ? String(initial[k]) : ""])),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [band, setBand] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: string) => (v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    setBand(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const missing = CRITERIA.find((c) => !values[c]);
    if (missing) return setMessage(`Choose a band for ${CRITERION_LABEL[missing]}.`);
    const input: Record<string, unknown> = Object.fromEntries(CRITERIA.map((c) => [c, Number(values[c])]));
    if (video) for (const { key } of EXTRAS) if (values[key]) input[key] = Number(values[key]);
    if (notes.trim()) input.notes = notes.trim();
    setErrors({});
    startTransition(async () => {
      try {
        const res = await saveSelfBandsAction(attemptId, input as Parameters<typeof saveSelfBandsAction>[1]);
        if (!res.ok) {
          setErrors(res.errors);
          return setMessage(firstError(res.errors) ?? "Couldn't save your bands. Try again.");
        }
        setBand(res.band);
        onSaved(input as SelfBands);
      } catch {
        setMessage("Couldn't save your bands. Try again.");
      }
    });
  }

  const complete = CRITERIA.every((c) => values[c]);
  const shown = band ?? (complete ? speakingBand(Object.fromEntries(CRITERIA.map((c) => [c, Number(values[c])])) as Record<Criterion, number>) : null);

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {CRITERIA.map((c) => (
          <Choice
            key={c}
            id={`band-${c}`}
            label={CRITERION_LABEL[c]}
            options={BANDS}
            value={values[c]}
            error={errors[c]}
            onChange={set(c)}
          />
        ))}
      </div>
      {video && (
        <div className="grid gap-3 sm:grid-cols-3">
          {EXTRAS.map(({ key, label, hint }) => (
            <Choice key={key} id={`extra-${key}`} label={label} hint={hint} options={SCORES} value={values[key]} error={errors[key]} onChange={set(key)} />
          ))}
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor="band-notes" className="text-sm font-medium">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="band-notes"
          rows={2}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={fieldClass}
          placeholder="What to do differently next time"
        />
      </div>
      {shown !== null && (
        <p className="text-sm">
          Speaking band {shown} <span className="text-muted-foreground">(the mean of your four bands, to the nearest half band)</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save my bands"}
        </Button>
        {message && <Notice>{message}</Notice>}
        {band !== null && !message && <Notice tone="ok">Bands saved.</Notice>}
      </div>
    </form>
  );
}
