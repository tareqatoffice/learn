"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveWritingTextAction, submitWritingAction } from "@/app/(app)/ielts/practice-actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { WritingView } from "@/ielts/writing/attempts";
import { MAX_TEXT_CHARS, MIN_WORDS, TASK_LIMIT_SEC, wordCount } from "@/ielts/writing/bands";
import { cn } from "@/lib/utils";

const SAVE_DELAY_MS = 1500;
const clock = (s: number) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;

/** Writes the task(s): live word count, timers that never cut you off, autosave, then submit. */
export function WritingRunner({ view, imageUrls }: { view: WritingView; imageUrls: string[] }) {
  const router = useRouter();
  const [texts, setTexts] = useState(() => view.tasks.map((t) => t.text));
  const [secs, setSecs] = useState(() => view.tasks.map((t) => t.timeSec));
  const [active, setActive] = useState(0);
  const { run, pending, errors } = useAdminAction();
  const dirty = useRef(new Set<number>());
  const latest = useRef({ texts, secs });
  useEffect(() => {
    latest.current = { texts, secs };
  }, [texts, secs]);

  useEffect(() => {
    const t = setInterval(() => setSecs((all) => all.map((s, i) => (i === active ? s + 1 : s))), 1000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    const t = setTimeout(() => {
      for (const i of [...dirty.current]) {
        dirty.current.delete(i);
        void saveWritingTextAction(view.id, i, latest.current.texts[i], latest.current.secs[i]).catch(() => dirty.current.add(i));
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [texts, view.id]);

  const full = view.kind === "full";
  const totalLimit = view.tasks.reduce((n, t) => n + TASK_LIMIT_SEC[t.task], 0);
  const spent = secs.reduce((a, b) => a + b, 0);
  const task = view.tasks[active];
  const words = wordCount(texts[active]);
  const min = MIN_WORDS[task.task];
  const left = (full ? totalLimit - spent : TASK_LIMIT_SEC[task.task] - secs[active]) | 0;

  const submit = () => {
    const short = view.tasks.map((t, i) => (wordCount(texts[i]) < MIN_WORDS[t.task] ? t.task : null)).filter(Boolean);
    run(
      async () => {
        for (let i = 0; i < view.tasks.length; i++) {
          const saved = await saveWritingTextAction(view.id, i, texts[i], secs[i]);
          if (!saved.ok) return saved;
        }
        return submitWritingAction(view.id);
      },
      {
        confirm: short.length ? "One answer is under the minimum length, which lowers the band in the real test. Submit anyway?" : undefined,
        refresh: false,
        onSuccess: () => router.refresh(),
      },
    );
  };

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-2">
        <span role="timer" aria-label="Time left" className={cn("font-mono text-lg", left < 0 && "text-destructive")}>
          {left < 0 ? "-" : ""}
          {clock(left)}
        </span>
        <span className="text-xs text-muted-foreground">The timer never cuts you off. Your text saves automatically.</span>
        <Button type="button" disabled={pending || texts.some((t) => !t.trim())} onClick={submit}>
          Submit
        </Button>
      </div>
      <ActionStatus saved={false} errors={errors} />

      {view.tasks.length > 1 && (
        <div role="tablist" aria-label="Tasks" className="flex gap-2">
          {view.tasks.map((t, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn("rounded-md border px-3 py-1 text-sm", i === active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
            >
              {t.task === "task1" ? "Task 1" : "Task 2"}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <article aria-label="Task" className="grid content-start gap-3 rounded-lg border border-border p-4 text-sm">
          <h2 className="font-medium">{task.title}</h2>
          <p className="whitespace-pre-wrap">{task.brief}</p>
          {imageUrls[active] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrls[active]} alt={task.imageAlt || "Chart for Task 1"} className="max-w-full rounded border border-border" />
          )}
        </article>
        <div className="grid content-start gap-2">
          <label htmlFor="essay" className="text-sm font-medium">
            Your answer
          </label>
          <textarea
            id="essay"
            className="min-h-96 w-full rounded-md border border-border bg-background p-3 text-sm leading-relaxed"
            value={texts[active]}
            maxLength={MAX_TEXT_CHARS}
            spellCheck
            onChange={(e) => {
              dirty.current.add(active);
              setTexts((all) => all.map((t, i) => (i === active ? e.target.value : t)));
            }}
          />
          <p className={cn("text-sm", words < min ? "text-muted-foreground" : "text-ok")} role="status">
            {words} words · minimum {min}
          </p>
        </div>
      </div>
    </div>
  );
}
