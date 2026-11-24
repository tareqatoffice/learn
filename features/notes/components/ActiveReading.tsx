"use client";

import { useState } from "react";
import { savePreQuestionsAction, saveRecitationAction } from "@/app/(app)/notes/actions";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PREQ_MAX_LEN, PREQ_MAX_QUESTIONS, RECITE_MAX, type ReciteVerdict } from "@/models/studyConstants";

type Recitation = { text: string; verdict: ReciteVerdict };

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function PreReadQuestions({ noteId, initial }: { noteId: string; initial: string[] }) {
  const [saved, setSaved] = useState(initial);
  const [questions, setQuestions] = useState(() =>
    Array.from({ length: Math.max(2, initial.length) }, (_, i) => initial[i] ?? ""),
  );
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [open, setOpen] = useState(initial.length === 0);

  async function save() {
    setPending(true);
    setFailed(false);
    setJustSaved(false);
    try {
      await savePreQuestionsAction(noteId, questions);
      setSaved(questions.map((q) => q.trim()).filter(Boolean));
      setJustSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="mt-4 rounded-lg border border-border bg-card p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold">
        Before you read{saved.length > 0 ? ` · ${saved.length} question${saved.length === 1 ? "" : "s"}` : ""}
      </summary>
      <div className="mt-3 grid gap-3">
        <p className="text-sm text-muted-foreground">
          Skim the headings, then write {PREQ_MAX_QUESTIONS - 1} to {PREQ_MAX_QUESTIONS} questions you want this chapter to answer.
        </p>
        {questions.map((q, i) => (
          <label key={i} className="grid gap-1 text-sm">
            <span className="sr-only">Question {i + 1}</span>
            <input
              value={q}
              maxLength={PREQ_MAX_LEN}
              placeholder={`Question ${i + 1}`}
              onChange={(e) => setQuestions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              className={fieldClass}
            />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void save()} disabled={pending}>
            Save questions
          </Button>
          {justSaved && <span className="text-sm text-muted-foreground">Saved</span>}
          {failed && <Notice>Could not save. Try again.</Notice>}
        </div>
      </div>
    </details>
  );
}

function ReciteRow({
  noteId,
  anchor,
  title,
  initial,
  onVerdict,
}: {
  noteId: string;
  anchor: string;
  title: string;
  initial?: Recitation;
  onVerdict: (anchor: string, verdict: ReciteVerdict) => void;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [verdict, setVerdict] = useState<ReciteVerdict | null>(initial?.verdict ?? null);
  const [savedText, setSavedText] = useState(initial?.text ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edited = verdict !== null && text.trim() !== savedText;
  const shown = edited ? null : verdict;

  async function rate(next: ReciteVerdict) {
    if (!text.trim()) {
      setError("Write one sentence first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await saveRecitationAction(noteId, anchor, text, next);
      setVerdict(next);
      setSavedText(text.trim());
      onVerdict(anchor, next);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">{title}</span>
        <textarea
          value={text}
          rows={2}
          maxLength={RECITE_MAX}
          placeholder="The main idea, in one sentence"
          onChange={(e) => setText(e.target.value)}
          className={cn(fieldClass, "resize-y")}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={shown === "got" ? "default" : "outline"} aria-pressed={shown === "got"} disabled={pending} onClick={() => void rate("got")}>
          Got it
        </Button>
        <Button size="sm" variant={shown === "review" ? "default" : "outline"} aria-pressed={shown === "review"} disabled={pending} onClick={() => void rate("review")}>
          Review
        </Button>
        {edited && !error && <span className="text-xs text-muted-foreground">Edited. Choose Got it or Review to save.</span>}
        {error && <Notice>{error}</Notice>}
      </div>
    </li>
  );
}

export function ReciteList({
  noteId,
  sections,
  initial,
  questions,
}: {
  noteId: string;
  sections: { anchor: string; text: string }[];
  initial: Record<string, Recitation>;
  questions: string[];
}) {
  const [verdicts, setVerdicts] = useState<Record<string, ReciteVerdict | undefined>>(() =>
    Object.fromEntries(Object.entries(initial).map(([anchor, r]) => [anchor, r.verdict])),
  );
  if (sections.length === 0) return null;
  const shownAnchors = new Set(sections.map((s) => s.anchor));
  const review = Object.entries(verdicts).filter(([anchor, v]) => v === "review" && shownAnchors.has(anchor)).length;

  return (
    <section aria-labelledby="recite-title" className="mt-10 grid gap-3">
      <div className="grid gap-1">
        <h2 id="recite-title" className="text-lg font-semibold">
          Recite what you read
        </h2>
        <p className="text-sm text-muted-foreground">
          Close your eyes, then write each main idea in your own words. Retrieving it beats rereading.
          {review > 0 && ` ${review} to review.`}
        </p>
      </div>
      {questions.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Your questions. Did the chapter answer them?</p>
          <ul className="mt-1 list-disc pl-5">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="grid gap-3">
        {sections.map((s) => (
          <ReciteRow
            key={s.anchor}
            noteId={noteId}
            anchor={s.anchor}
            title={s.text}
            initial={initial[s.anchor]}
            onVerdict={(anchor, verdict) => setVerdicts((prev) => ({ ...prev, [anchor]: verdict }))}
          />
        ))}
      </ul>
    </section>
  );
}
