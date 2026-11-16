"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { claimSectionAction, finishSectionAction, saveAnswersAction, submitAttemptAction } from "@/app/(app)/ielts/practice-actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { RunView, SectionAudioKind } from "@/ielts/practice/attempts";
import { choicesFor, letter, type PublicGroup, type PublicQuestion } from "@/ielts/practice/marking";
import { cn } from "@/lib/utils";

const SAVE_DELAY_MS = 1200;
const RETRY_MS = 5000;

function clock(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Plays a Listening section: the recording, or the browser voice reading the script. Both are claimed
 * from the server when Play is pressed (a fresh link, or the script). A full test allows one play,
 * used up only when playback reaches the end, so a reload or a load error can be retried. Every
 * section's player stays mounted for the whole attempt, so switching sections never stops the audio.
 */
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

  // A full test records the play on the server; a drill can simply be played again.
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
      {/* A drill gets a normal player once its link is signed; a full test plays through once, with no controls. */}
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
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Answer({ q, group, value, onChange }: { q: PublicQuestion; group: PublicGroup; value: string; onChange: (v: string) => void }) {
  const choices = choicesFor(q.kind, q, group);
  if (!choices.length) {
    return <input className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm" value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} aria-label={`Answer to question ${q.n}`} />;
  }
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
            onClick={() => onChange(on ? "" : c)}
            className={cn(
              "rounded-md border px-3 py-1 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            {text ? `${c}. ${text}` : c}
          </button>
        );
      })}
    </div>
  );
}

/** The answer sheet for a Listening or Reading attempt: timer, autosave, submit. Marking happens on the server. */
export function TestRunner({ view }: { view: RunView }) {
  const [answers, setAnswers] = useState<Record<string, string>>(view.answers);
  const [index, setIndex] = useState(0);
  const dirty = useRef<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  const full = view.scope === "full";
  const deadline = new Date(view.startedAt).getTime() + view.limitSec * 1000;
  // null until mounted: the server render has no clock to agree with the browser's.
  const [left, setLeft] = useState<number | null>(null);
  const submitting = useRef(false);
  const lastAutoTry = useRef(0);
  const { run, pending, errors } = useAdminAction();

  const submit = useCallback(
    (confirm?: string) => {
      if (submitting.current) return;
      run(
        async () => {
          // Set inside the action so a declined confirm never leaves the guard on.
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

  // The full test submits itself at the limit; a failed try is repeated every few seconds.
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
    saveAnswersAction(view.id, batch).catch(() => {
      // Keep the answers and try again shortly; a newer value for the same question wins.
      dirty.current = { ...batch, ...dirty.current };
      setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
    });
  }, [view.id]);

  useEffect(() => {
    if (!Object.keys(dirty.current).length) return;
    const t = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [answers, retry, flush]);

  // Best effort when the tab is hidden or closed.
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
        <Button type="button" disabled={pending} onClick={() => submit(answered < total ? `You have ${total - answered} unanswered. Submit anyway?` : undefined)}>
          Submit
        </Button>
      </div>
      <ActionStatus saved={false} errors={errors} />
      {left !== null && left <= 0 && !full && <p role="status" className="text-sm text-muted-foreground">Time is up for this section. You can keep going, then submit.</p>}

      {view.sections.length > 1 && (
        <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-2">
          {view.sections.map((s, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={cn("rounded-md border px-3 py-1 text-sm", i === index ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
            >
              {s.title}
            </button>
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
