"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveFocusPlanAction, saveWeeklyReviewAction } from "@/app/(app)/focus-actions";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { firstError } from "@/features/admin/result";
import type { FocusPlanView, ReviewAnswers } from "@/features/focus/review";
import {
  FOCUS_PLAN_ACTION_MAX,
  FOCUS_PLAN_MAX_MINUTES,
  FOCUS_PLAN_MIN_MINUTES,
  FOCUS_REVIEW_TEXT_MAX,
} from "@/models/focusConstants";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const QUESTIONS: { key: keyof ReviewAnswers; label: string }[] = [
  { key: "helped", label: "What helped me focus most this week?" },
  { key: "pulledAway", label: "What pulled me away most often, and how can I remove it?" },
  { key: "change", label: "What one change will I make next week?" },
];

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string };

export function ReviewForm({ weekStart, initial }: { weekStart: string; initial: ReviewAnswers | null }) {
  const [answers, setAnswers] = useState<ReviewAnswers>(initial ?? { helped: "", pulledAway: "", change: "" });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const res = await saveWeeklyReviewAction(weekStart, answers);
      setStatus(res.ok ? { kind: "saved" } : { kind: "error", message: firstError(res.errors) ?? "Could not save." });
    } catch {
      setStatus({ kind: "error", message: "Could not save. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      {QUESTIONS.map((q) => (
        <label key={q.key} className="grid gap-1.5 text-sm">
          <span className="font-medium">{q.label}</span>
          <textarea
            value={answers[q.key]}
            rows={3}
            maxLength={FOCUS_REVIEW_TEXT_MAX}
            onChange={(e) => {
              setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }));
              setStatus({ kind: "idle" });
            }}
            className={`${fieldClass} resize-y`}
          />
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={pending}>
          Save review
        </Button>
        {status.kind === "saved" && <span className="text-sm text-muted-foreground">Saved</span>}
        {status.kind === "error" && <Notice>{status.message}</Notice>}
      </div>
    </div>
  );
}

export function PlanForm({ initial, suggestedMinutes }: { initial: FocusPlanView | null; suggestedMinutes: number }) {
  const [time, setTime] = useState(initial?.time ?? "19:00");
  const [action, setAction] = useState(initial?.action ?? "sit at my desk with my phone in another room and focus");
  const [minutes, setMinutes] = useState(String(initial?.minutes ?? suggestedMinutes));
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function save() {
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const res = await saveFocusPlanAction({ time, action, minutes: Number(minutes), enabled });
      if (res.ok) router.refresh();
      setStatus(res.ok ? { kind: "saved" } : { kind: "error", message: firstError(res.errors) ?? "Could not save." });
    } catch {
      setStatus({ kind: "error", message: "Could not save. Try again." });
    } finally {
      setPending(false);
    }
  }

  const touch = () => setStatus({ kind: "idle" });

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 text-sm sm:grid-cols-[auto_auto_1fr] sm:items-center">
        <label className="grid gap-1.5 sm:flex sm:items-center sm:gap-2">
          <span className="font-medium">If it is</span>
          <input
            type="time"
            required
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              touch();
            }}
            className={fieldClass}
          />
        </label>
        <span aria-hidden className="hidden font-medium sm:inline">
          then I
        </span>
        <label className="grid gap-1.5">
          <span className="font-medium sm:sr-only">then I</span>
          <input
            value={action}
            maxLength={FOCUS_PLAN_ACTION_MAX}
            onChange={(e) => {
              setAction(e.target.value);
              touch();
            }}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium">for</span>
        <input
          type="number"
          inputMode="numeric"
          min={FOCUS_PLAN_MIN_MINUTES}
          max={FOCUS_PLAN_MAX_MINUTES}
          value={minutes}
          onChange={(e) => {
            setMinutes(e.target.value);
            touch();
          }}
          className={`${fieldClass} w-24`}
        />
        <span>minutes</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            touch();
          }}
        />
        Remind me in the app at that time
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={pending}>
          Save plan
        </Button>
        {status.kind === "saved" && <span className="text-sm text-muted-foreground">Saved</span>}
        {status.kind === "error" && <Notice>{status.message}</Notice>}
      </div>
    </div>
  );
}
