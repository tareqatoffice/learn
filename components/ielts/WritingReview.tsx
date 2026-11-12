"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteWritingAction, saveWritingSelfAction, writingEstimateAction } from "@/app/(app)/ielts/practice-actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { Bands, WritingView } from "@/ielts/writing/attempts";
import { MIN_WORDS, taskBand, WRITING_CRITERIA, writingCriterionLabel, type WritingCriterion } from "@/ielts/writing/bands";

type TaskView = WritingView["tasks"][number];

function TaskReview({ attemptId, index, task }: { attemptId: string; index: number; task: TaskView }) {
  const rate = useAdminAction();
  const ask = useAdminAction();
  const [self, setSelf] = useState<Partial<Record<WritingCriterion, number>>>(() => ({ ...task.self }));
  const [notes, setNotes] = useState(task.self?.notes ?? "");
  const [aiError, setAiError] = useState("");
  const rated = WRITING_CRITERIA.every((c) => typeof task.self?.[c] === "number");
  const label = task.task === "task1" ? "Task 1" : "Task 2";

  return (
    <section className="grid gap-4 rounded-lg border border-border p-4" aria-label={label}>
      <h2 className="font-medium">
        {label}: {task.title}
      </h2>
      <p className="text-sm text-muted-foreground">
        {task.wordCount} words{task.wordCount < MIN_WORDS[task.task] ? ` (under the ${MIN_WORDS[task.task]}-word minimum)` : ""}
      </p>
      <details className="rounded-md border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Your answer</summary>
        <p className="mt-2 whitespace-pre-wrap">{task.text}</p>
      </details>

      <div className="grid gap-3">
        <h3 className="text-sm font-medium">1. Rate yourself first</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {WRITING_CRITERIA.map((c) => (
            <label key={c} className="grid gap-1 text-sm">
              {writingCriterionLabel(c, task.task)}
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5"
                value={self[c] ?? ""}
                onChange={(e) => {
                  rate.touch();
                  setSelf((s) => ({ ...s, [c]: e.target.value ? Number(e.target.value) : undefined }));
                }}
              >
                <option value="">Choose a band</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((b) => (
                  <option key={b} value={b}>
                    Band {b}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="grid gap-1 text-sm">
          Notes (optional)
          <textarea className="rounded-md border border-border bg-background p-2" rows={2} value={notes} onChange={(e) => { rate.touch(); setNotes(e.target.value); }} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={rate.pending} onClick={() => rate.run(() => saveWritingSelfAction(attemptId, index, { ...self, notes }))}>
            Save my rating
          </Button>
          <ActionStatus saved={rate.saved} errors={rate.errors} savedText="Saved." />
          {rated && <span className="text-sm">Your band for this task: {taskBand(task.self as Bands)}</span>}
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-medium">2. AI estimate</h3>
        {!rated ? (
          <p className="text-sm text-muted-foreground">Save your own rating first, then you can ask for an AI estimate.</p>
        ) : !task.ai ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={ask.pending}
              onClick={() =>
                ask.run(
                  async () => {
                    const res = await writingEstimateAction(attemptId, index);
                    setAiError(res.ok ? "" : res.error);
                    return res.ok ? { ok: true as const } : { ok: false as const, errors: { _: res.error } };
                  },
                  {},
                )
              }
            >
              {ask.pending ? "Estimating..." : "Get AI estimate"}
            </Button>
            <ActionStatus saved={false} errors={aiError ? { _: aiError } : ask.errors} />
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <p>
              AI <strong>estimate</strong>: band {task.ai.overall}. It reads your text only, so treat it as a guide; your own judgement stands.
              {task.task === "task1" && " It cannot see the chart."}
            </p>
            <ul className="grid gap-2">
              {WRITING_CRITERIA.map((c) => {
                const mine = task.self?.[c] as number;
                const theirs = task.ai!.bands[c];
                const gap = Math.abs(mine - theirs) >= 1;
                return (
                  <li key={c} className={gap ? "rounded-md border border-border bg-muted p-3" : "p-3"}>
                    <p className="font-medium">
                      {writingCriterionLabel(c, task.task)}: you {mine}, AI {theirs}
                      {gap && " (differs by a band or more)"}
                    </p>
                    <p>{task.ai!.reasons[c]}</p>
                    {task.ai!.evidence[c].map((q, i) => (
                      <blockquote key={i} className="border-l-2 border-border pl-2 text-muted-foreground">
                        {q}
                      </blockquote>
                    ))}
                  </li>
                );
              })}
            </ul>
            <div>
              <h4 className="font-medium">Strengths</h4>
              <ul className="list-disc pl-5">{task.ai.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div>
              <h4 className="font-medium">To reach the next band</h4>
              <ul className="grid gap-2">
                {task.ai.improvements.map((m, i) => (
                  <li key={i}>
                    <p>{m.advice}</p>
                    <p className="text-muted-foreground">You wrote: “{m.original}”</p>
                    <p>Try: “{m.rewrite}”</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** The submitted answer(s): rate yourself, then ask for the AI estimate, side by side. */
export function WritingReview({ view }: { view: WritingView }) {
  const router = useRouter();
  const del = useAdminAction();
  return (
    <div className="grid gap-6">
      {view.selfBand !== null && (
        <p className="rounded-lg border border-border p-4 text-sm">
          Your Writing band{view.kind === "full" ? " (Task 2 counts twice as much as Task 1)" : ""}: <strong>{view.selfBand}</strong>
          {view.aiBand !== null && (
            <>
              {" "}
              · AI estimate: <strong>{view.aiBand}</strong>
            </>
          )}
          {view.kind !== "full" && " · A single task isn't added to your band history."}
        </p>
      )}
      {view.tasks.map((t, i) => (
        <TaskReview key={i} attemptId={view.id} index={i} task={t} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/ielts/writing" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Back to Writing
        </Link>
        <Button type="button" variant="outline" disabled={del.pending} onClick={() => del.run(() => deleteWritingAction(view.id), { confirm: "Delete this attempt?", refresh: false, onSuccess: () => router.push("/ielts/writing") })}>
          Delete attempt
        </Button>
        <ActionStatus saved={false} errors={del.errors} />
      </div>
    </div>
  );
}
