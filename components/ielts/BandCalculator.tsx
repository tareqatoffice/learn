"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCalculatorResultAction } from "@/app/(app)/ielts/actions";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { listeningBand, overallBand, readingBand } from "@/ielts/bands";
import { bandLabel } from "./format";

type Source = "practice" | "official" | "other";

const SOURCE_LABEL: Record<Source, string> = { practice: "Practice test", official: "Official result", other: "Other" };
const WRITING_BANDS = Array.from({ length: 19 }, (_, i) => i / 2);
const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive";

/** A whole number 0–40, or undefined when the field is empty or not valid. */
function parseRaw(s: string): number | undefined {
  if (!/^\d{1,2}$/.test(s.trim())) return undefined;
  const n = Number(s);
  return n <= 40 ? n : undefined;
}

function Result({ id, label, value }: { id: string; label: string; value?: number }) {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span data-testid={id} className="text-lg font-semibold tabular-nums">
        {value === undefined ? "–" : bandLabel(value)}
      </span>
    </div>
  );
}

/**
 * Raw Listening and Reading scores (out of 40) become bands from the approximate Academic tables;
 * Writing and Speaking bands are picked. The overall band shows once all four are in. Works without
 * a profile. `source` locks where a saved result comes from (the post-test prompt uses "official").
 */
export function BandCalculator({ today, source: lockedSource }: { today: string; source?: Source }) {
  const router = useRouter();
  const [listening, setListening] = useState("");
  const [reading, setReading] = useState("");
  const [writing, setWriting] = useState("");
  const [speaking, setSpeaking] = useState("");
  const [source, setSource] = useState<Source>(lockedSource ?? "practice");
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const listeningRaw = parseRaw(listening);
  const readingRaw = parseRaw(reading);
  const bands = {
    listening: listeningRaw === undefined ? undefined : listeningBand(listeningRaw),
    reading: readingRaw === undefined ? undefined : readingBand(readingRaw),
    writing: writing === "" ? undefined : Number(writing),
    speaking: speaking === "" ? undefined : Number(speaking),
  };
  const overall =
    bands.listening !== undefined && bands.reading !== undefined && bands.writing !== undefined && bands.speaking !== undefined
      ? overallBand({ listening: bands.listening, reading: bands.reading, writing: bands.writing, speaking: bands.speaking })
      : undefined;
  const formError = errors._ ?? Object.entries(errors).find(([k]) => k !== "date")?.[1];
  const anything = Object.values(bands).some((b) => b !== undefined);
  const rawError = (s: string, n: number | undefined) => (s.trim() !== "" && n === undefined ? "Enter a whole number from 0 to 40." : undefined);

  function touch<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setSaved(false);
      setErrors({});
    };
  }

  function save() {
    setErrors({});
    setSaved(false);
    start(async () => {
      const res = await saveCalculatorResultAction({
        date,
        source,
        ...(listeningRaw !== undefined ? { listeningRaw } : {}),
        ...(readingRaw !== undefined ? { readingRaw } : {}),
        ...(bands.writing !== undefined ? { writing: bands.writing } : {}),
        ...(bands.speaking !== undefined ? { speaking: bands.speaking } : {}),
      });
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (anything) save();
      }}
      className="grid gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["Listening raw score (out of 40)", listening, touch(setListening), rawError(listening, listeningRaw)],
            ["Reading raw score (out of 40)", reading, touch(setReading), rawError(reading, readingRaw)],
          ] as const
        ).map(([label, value, onChange, error]) => (
          <label key={label} className="grid gap-1.5 text-sm font-medium">
            {label}
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={error ? true : undefined}
              className={fieldClass}
            />
            {error && <Notice>{error}</Notice>}
          </label>
        ))}
        {(
          [
            ["Writing band", writing, touch(setWriting)],
            ["Speaking band", speaking, touch(setSpeaking)],
          ] as const
        ).map(([label, value, onChange]) => (
          <label key={label} className="grid gap-1.5 text-sm font-medium">
            {label}
            <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
              <option value="">Not entered</option>
              {WRITING_BANDS.map((b) => (
                <option key={b} value={b}>
                  {bandLabel(b)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div aria-live="polite" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Result id="band-listening" label="Listening" value={bands.listening} />
        <Result id="band-reading" label="Reading" value={bands.reading} />
        <Result id="band-writing" label="Writing" value={bands.writing} />
        <Result id="band-speaking" label="Speaking" value={bands.speaking} />
        {overall !== undefined ? (
          <Result id="band-overall" label="Overall" value={overall} />
        ) : (
          <p className="col-span-2 self-center text-xs text-muted-foreground sm:col-span-1">Overall shows once all four are entered.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Listening and Reading bands are approximate, based on commonly published tables. They are not official.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {lockedSource ? (
          <p className="self-end text-sm text-muted-foreground">This is saved as your {SOURCE_LABEL[lockedSource].toLowerCase()}.</p>
        ) : (
          <label className="grid gap-1.5 text-sm font-medium">
            Source
            <select value={source} onChange={(e) => setSource(e.target.value as Source)} className={fieldClass}>
              {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1.5 text-sm font-medium">
          Date
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-invalid={errors.date ? true : undefined} className={fieldClass} />
          {errors.date && <Notice>{errors.date}</Notice>}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !anything}>
          Save result
        </Button>
        {saved && <Notice tone="ok">Saved to your band history.</Notice>}
        {formError && <Notice>{formError}</Notice>}
      </div>
    </form>
  );
}
