"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveAnswersAction, submitAttemptAction } from "@/app/(app)/ielts/practice-actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { RunView } from "@/ielts/practice/attempts";
import { choicesFor, letter, type PublicGroup, type PublicQuestion } from "@/ielts/practice/marking";
import { cn } from "@/lib/utils";

const SAVE_DELAY_MS = 1200;

function clock(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Plays a Listening section: the recording, or the browser voice reading the script. One play only in a full test. */
function SectionAudio({ url, script, once }: { url: string; script: string; once: boolean }) {
  const [played, setPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (url && !once) return <audio controls src={url} className="w-full" aria-label="Section audio" />;
  if (!url && !script) return <p className="text-sm text-muted-foreground">No audio for this section.</p>;

  const play = () => {
    setPlayed(true);
    setPlaying(true);
    if (url) {
      void ref.current?.play();
      return;
    }
    const u = new SpeechSynthesisUtterance(script);
    u.lang = "en-GB";
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="grid gap-2">
      {url && <audio ref={ref} src={url} onEnded={() => setPlaying(false)} aria-label="Section audio" />}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={played} onClick={play}>
          {playing ? "Playing..." : played ? "Played" : "Play audio"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {once ? "You can play it once, like the real test. " : ""}
          {!url ? "Computer voice, not the real test sound." : ""}
        </span>
      </div>
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
export function TestRunner({ view, audioUrls }: { view: RunView; audioUrls: string[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>(view.answers);
  const [index, setIndex] = useState(0);
  const dirty = useRef<Record<string, string>>({});
  const full = view.scope === "full";
  const deadline = new Date(view.startedAt).getTime() + view.limitSec * 1000;
  const [left, setLeft] = useState(() => Math.round((deadline - Date.now()) / 1000));
  const submitted = useRef(false);
  const { run, pending, errors } = useAdminAction();

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    run(() => submitAttemptAction(view.id, { ...answers, ...dirty.current }), { refresh: true });
  }, [run, view.id, answers]);

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.round((deadline - Date.now()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  useEffect(() => {
    if (full && left <= 0) submit();
  }, [full, left, submit]);

  useEffect(() => {
    if (!Object.keys(dirty.current).length) return;
    const t = setTimeout(() => {
      const batch = dirty.current;
      dirty.current = {};
      void saveAnswersAction(view.id, batch).catch(() => {
        dirty.current = { ...batch, ...dirty.current };
      });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [answers, view.id]);

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
        <span role="timer" aria-label="Time left" className={cn("font-mono text-lg", left <= 60 && "text-destructive")}>
          {left >= 0 ? clock(left) : `-${clock(-left)}`}
        </span>
        <Button type="button" disabled={pending} onClick={() => run(() => submitAttemptAction(view.id, { ...answers, ...dirty.current }), { confirm: answered < total ? `You have ${total - answered} unanswered. Submit anyway?` : undefined })}>
          Submit
        </Button>
      </div>
      <ActionStatus saved={false} errors={errors} />
      {left <= 0 && !full && <p role="status" className="text-sm text-muted-foreground">Time is up for this section. You can keep going, then submit.</p>}

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
          <SectionAudio key={index} url={audioUrls[index] ?? ""} script={view.scripts[index] ?? ""} once={full} />
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
