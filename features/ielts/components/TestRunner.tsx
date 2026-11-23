"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { claimSectionAction, deleteTestAttemptAction, finishSectionAction, saveAnswersAction, submitAttemptAction } from "@/app/(app)/ielts/practice-actions";
import { DiscardAttempt } from "@/features/ielts/components/DiscardAttempt";
import { ActionStatus } from "@/features/admin/components/SaveBar";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { chipClass, Tab } from "@/components/Chip";
import { Button } from "@/components/ui/button";
import type { RunView, SectionAudioKind } from "@/features/ielts/practice/attempts";
import { choicesFor, letter, type PublicGroup, type PublicQuestion } from "@/features/ielts/practice/marking";
import { rovingIndex, timeWarning } from "@/features/ielts/lib/a11y";
import { clock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/Notice";

const SAVE_DELAY_MS = 1200;
const RETRY_MS = 5000;


function SectionAudio({ kind, once, attemptId, index, heard }: { kind: SectionAudioKind; once: boolean; attemptId: string; index: number; heard: boolean }) {
  const [state, setState] = useState<"idle" | "playing" | "done">(heard ? "done" : "idle");
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (kind === "none") return <p className="text-sm text-muted-foreground">No audio for this section.</p>;

  const failed = (message: string) => {
    setState("idle");
    setSrc("");
    setError(message);
  };

  const finished = () => {
    if (!once) return setState("idle");
    setState("done");
    finishSectionAction(attemptId, index).catch(() => undefined);
  };

  const play = async () => {
    setError("");
    setState("playing");
    const res = await claimSectionAction(attemptId, index).catch(() => null);
    if (!res?.ok) return failed((res && res.errors._) || "Couldn't start the audio. Try again.");
    if (res.play.kind === "file") {
      setSrc(res.play.url);
      return;
    }
    const u = new SpeechSynthesisUtterance(res.play.script);
    u.lang = "en-GB";
    u.onend = finished;
    u.onerror = () => failed("The computer voice stopped. Press Play to start again.");
    window.speechSynthesis.speak(u);
  };

  const loadError = () => failed("The audio couldn't be loaded. Press Play to try again, or ask your admin to check the file.");

  return (
    <div className="grid gap-2">
      {src && !once && <audio controls autoPlay src={src} onError={loadError} className="w-full" aria-label="Section audio" />}
      {src && once && <audio autoPlay src={src} onEnded={finished} onError={loadError} aria-label="Section audio" />}
      {!(src && !once) && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={state !== "idle"} onClick={() => void play()}>
            {state === "playing" ? "Playing..." : state === "done" ? "Played" : "Play audio"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {once ? "You can play it once, like the real test. " : ""}
            {kind === "voice" ? "Computer voice, not the real test sound." : ""}
          </span>
        </div>
      )}
      {error && (
        <Notice>
          {error}
        </Notice>
      )}
    </div>
  );
}

function Answer({ q, group, value, onChange }: { q: PublicQuestion; group: PublicGroup; value: string; onChange: (v: string) => void }) {
  const choices = choicesFor(q.kind, q, group);
  if (!choices.length) {
    return <input className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm" value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} aria-label={`Answer to question ${q.n}`} />;
  }
  const picked = choices.indexOf(value);
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = rovingIndex(e.key, i, choices.length);
    if (next === null) return;
    e.preventDefault();
    onChange(choices[next]);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={`Answer to question ${q.n}`} className="flex flex-wrap gap-2">
      {choices.map((c, i) => {
        const text = q.kind === "mcq" ? q.options[i] : q.kind === "matching" ? group.options[i] : "";
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === (picked === -1 ? 0 : picked) ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(on ? "" : c)}
            className={chipClass(on)}
          >
            {text ? `${c}. ${text}` : c}
          </button>
        );
      })}
    </div>
  );
}

export function TestRunner({ view }: { view: RunView }) {
  const [answers, setAnswers] = useState<Record<string, string>>(view.answers);
  const [index, setIndex] = useState(0);
  const dirty = useRef<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [retry, setRetry] = useState(0);
  const full = view.scope === "full";
  const deadline = new Date(view.startedAt).getTime() + view.limitSec * 1000;
  const [left, setLeft] = useState<number | null>(null);
  const submitting = useRef(false);
  const lastAutoTry = useRef(0);
  const { run, pending, errors } = useAdminAction();

  const submit = useCallback(
    (confirm?: string) => {
      if (submitting.current) return;
      run(
        async () => {
          submitting.current = true;
          try {
            const res = await submitAttemptAction(view.id, { ...answers, ...dirty.current });
            if (!res.ok) submitting.current = false;
            return res;
          } catch (e) {
            submitting.current = false;
            throw e;
          }
        },
        { confirm, refresh: true },
      );
    },
    [run, view.id, answers],
  );

  useEffect(() => {
    const tick = () => setLeft(Math.round((deadline - Date.now()) / 1000));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [deadline]);

  useEffect(() => {
    if (!full || left === null || left > 0 || submitting.current) return;
    if (Date.now() - lastAutoTry.current < RETRY_MS) return;
    lastAutoTry.current = Date.now();
    submit();
  }, [full, left, submit]);

  const flush = useCallback(() => {
    const batch = dirty.current;
    if (!Object.keys(batch).length) return;
    dirty.current = {};
    saveAnswersAction(view.id, batch)
      .then((res) => {
        if (!res.ok) setSaveError(res.errors._ ?? "Your answers aren't being saved. Submit, or reload the page.");
        else setSaveError("");
      })
      .catch(() => {
        dirty.current = { ...batch, ...dirty.current };
        setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
      });
  }, [view.id]);

  useEffect(() => {
    if (!Object.keys(dirty.current).length) return;
    const t = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [answers, retry, flush]);

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

  const set = (n: number, v: string) => {
    dirty.current[String(n)] = v;
    setAnswers((a) => ({ ...a, [String(n)]: v }));
  };

  const section = view.sections[index];
  const answered = Object.values(answers).filter((v) => v.trim()).length;
  const total = view.sections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.questions.length, 0), 0);
  const listening = view.skill === "listening";

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-2">
        <span className="text-sm">
          {answered}/{total} answered
        </span>
        <span role="timer" aria-label="Time left" className={cn("font-mono text-lg", left !== null && left <= 60 && "text-destructive")}>
          {left === null ? "--:--" : left >= 0 ? clock(left) : `-${clock(-left)}`}
        </span>
        <span aria-live="polite" className="sr-only">
          {timeWarning(left)}
        </span>
        <span className="flex items-center gap-2">
          <DiscardAttempt discard={() => deleteTestAttemptAction(view.id)} back={`/ielts/${view.skill}`} />
          <Button type="button" disabled={pending} onClick={() => submit(answered < total ? `You have ${total - answered} unanswered. Submit anyway?` : undefined)}>
            Submit
          </Button>
        </span>
      </div>
      <ActionStatus saved={false} errors={errors} />
      {saveError && (
        <Notice>
          {saveError}
        </Notice>
      )}
      {left !== null && left <= 0 && !full && <p role="status" className="text-sm text-muted-foreground">Time is up for this section. You can keep going, then submit.</p>}

      {view.sections.length > 1 && (
        <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-2">
          {view.sections.map((s, i) => (
            <Tab
              key={i}
              selected={i === index}
              onKeyDown={(e) => {
                const next = rovingIndex(e.key, i, view.sections.length);
                if (next === null) return;
                e.preventDefault();
                setIndex(next);
                (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
              }}
              onClick={() => setIndex(i)}
            >
              {s.title}
            </Tab>
          ))}
        </div>
      )}

      <div className={cn("grid gap-6", !listening && "lg:grid-cols-2")}>
        {listening ? (
          <div>
            {view.sections.map((_, i) => (
              <div key={i} hidden={i !== index}>
                <SectionAudio kind={view.audio[i] ?? "none"} once={full} attemptId={view.id} index={i} heard={view.played.includes(i)} />
              </div>
            ))}
          </div>
        ) : (
          <article aria-label="Passage" className="whitespace-pre-wrap rounded-lg border border-border p-4 text-sm leading-relaxed lg:max-h-[75vh] lg:overflow-y-auto">
            <h2 className="mb-2 font-medium">{section.title}</h2>
            {section.passage}
          </article>
        )}
        <div className="grid content-start gap-6 lg:max-h-[75vh] lg:overflow-y-auto">
          {section.groups.map((g, gi) => (
            <fieldset key={gi} className="grid gap-3">
              <legend className="text-sm font-medium">
                Questions {g.questions[0]?.n}–{g.questions[g.questions.length - 1]?.n}
                <span className="block font-normal text-muted-foreground">{g.instruction}</span>
              </legend>
              {g.kind === "matching" && (
                <ul className="rounded-md bg-muted p-3 text-sm">
                  {g.options.map((o, i) => (
                    <li key={i}>
                      <strong>{letter(i)}.</strong> {o}
                    </li>
                  ))}
                </ul>
              )}
              {g.questions.map((q) => (
                <div key={q.n} className="grid gap-1.5">
                  <p className="text-sm">
                    <strong>{q.n}.</strong> {q.prompt}
                  </p>
                  <Answer q={q} group={g} value={answers[String(q.n)] ?? ""} onChange={(v) => set(q.n, v)} />
                </div>
              ))}
            </fieldset>
          ))}
        </div>
      </div>
      <div className="flex justify-between">
        <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous section
        </Button>
        <Button type="button" variant="outline" disabled={index === view.sections.length - 1} onClick={() => setIndex(index + 1)}>
          Next section
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Answers save automatically.</p>
    </div>
  );
}
