"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteWritingAction, saveWritingTextAction, submitWritingAction } from "@/app/(app)/ielts/practice-actions";
import { DiscardAttempt } from "@/components/ielts/DiscardAttempt";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Tab } from "@/components/Chip";
import { Button } from "@/components/ui/button";
import type { WritingView } from "@/ielts/writing/attempts";
import { MAX_TEXT_CHARS, MIN_WORDS, TASK_LIMIT_SEC, wordCount } from "@/ielts/writing/bands";
import { rovingIndex, timeWarning } from "@/lib/a11y";
import { cn } from "@/lib/utils";

const SAVE_DELAY_MS = 1500;
const RETRY_MS = 5000;
const TIME_SAVE_MS = 30_000;
const clock = (s: number) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;

export function WritingRunner({ view, imageUrls }: { view: WritingView; imageUrls: string[] }) {
  const router = useRouter();
  const [texts, setTexts] = useState(() => view.tasks.map((t) => t.text));
  const [secs, setSecs] = useState(() => view.tasks.map((t) => t.timeSec));
  const [active, setActive] = useState(0);
  const { run, pending, errors } = useAdminAction();
  const dirty = useRef(new Set<number>());
  const [saveError, setSaveError] = useState("");
  const latest = useRef({ texts, secs });
  useEffect(() => {
    latest.current = { texts, secs };
  }, [texts, secs]);

  useEffect(() => {
    const t = setInterval(() => setSecs((all) => all.map((s, i) => (i === active ? s + 1 : s))), 1000);
    return () => clearInterval(t);
  }, [active]);

  const [retry, setRetry] = useState(0);
  const flush = useCallback(() => {
    for (const i of [...dirty.current]) {
      dirty.current.delete(i);
      saveWritingTextAction(view.id, i, latest.current.texts[i], latest.current.secs[i])
        .then((res) => {
          if (!res.ok) setSaveError(res.errors._ ?? "Your text isn't being saved. Reload the page.");
          else setSaveError("");
        })
        .catch(() => {
          dirty.current.add(i);
          setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
        });
    }
  }, [view.id]);

  useEffect(() => {
    if (!dirty.current.size) return;
    const t = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [texts, retry, flush]);

  useEffect(() => {
    const t = setInterval(() => {
      dirty.current.add(active);
      setRetry((n) => n + 1);
    }, TIME_SAVE_MS);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

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
        <span aria-live="polite" className="sr-only">
          {timeWarning(left)}
        </span>
        <span className="text-xs text-muted-foreground">The timer never cuts you off. Your text saves automatically.</span>
        <span className="flex items-center gap-2">
          <DiscardAttempt discard={() => deleteWritingAction(view.id)} back="/ielts/writing" />
          <Button
            type="button"
            disabled={pending || texts.some((t) => !t.trim())}
            aria-describedby={texts.some((t) => !t.trim()) ? "submit-why" : undefined}
            onClick={submit}
          >
            Submit
          </Button>
        </span>
        {texts.some((t) => !t.trim()) && (
          <span id="submit-why" className="w-full text-xs text-muted-foreground">
            Write something for {view.tasks.length > 1 ? "both tasks" : "the task"} to submit.
          </span>
        )}
      </div>
      <ActionStatus saved={false} errors={errors} />
      {saveError && (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      )}

      {view.tasks.length > 1 && (
        <div role="tablist" aria-label="Tasks" className="flex gap-2">
          {view.tasks.map((t, i) => (
            <Tab
              key={i}
              selected={i === active}
              onKeyDown={(e) => {
                const next = rovingIndex(e.key, i, view.tasks.length);
                if (next === null) return;
                e.preventDefault();
                setActive(next);
                (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
              }}
              onClick={() => setActive(i)}
            >
              {t.task === "task1" ? "Task 1" : "Task 2"}
            </Tab>
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
