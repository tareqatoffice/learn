"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { chipClass } from "@/components/Chip";
import { confirm } from "@/components/ConfirmDialog";
import { AnswerBox, FeedbackPanel, FollowUpChat } from "@/features/interview/components/QuizCoach";
import { Notice } from "@/components/Notice";
import { Button, buttonVariants } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown/Markdown";
import { answerModeOf, type QuizAttempt } from "@/lib/quiz-answer";
import type { MarkResult } from "@/features/progress/questions";
import type { SessionView } from "@/features/progress/quiz";
import type { AiGrade, AiReply, AiResult } from "@/features/progress/quizAi";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ProgressBar";
import { Card } from "@/components/Card";

type Card = NonNullable<SessionView["current"]>;

export type QuizCardProps = {
  view: SessionView;
  onResult: (result: MarkResult, attempt?: QuizAttempt) => Promise<SessionView>;
  onFinish: () => Promise<void>;
  coach?: QuizCoach;
};

export type QuizCoach = {
  grade: (questionId: string, answer: string) => Promise<AiResult<AiGrade>>;
  ask: (
    questionId: string,
    input: { conversationId?: string; message: string; answer?: string },
  ) => Promise<AiResult<AiReply>>;
};

const KEYS: Record<string, MarkResult> = { g: "got", r: "review", s: "skip" };

function ignoresShortcut(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || e.repeat) return true;
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

const activatesOnSpace = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest("button, a[href], summary, [role='button']"));

const suggestedRing = "ring-2 ring-ring ring-offset-2 ring-offset-card";

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd aria-hidden className="ml-1.5 rounded border border-current px-1 text-[0.6875rem] font-sans leading-4 opacity-60">
      {children}
    </kbd>
  );
}

export function QuizCard({ view, onResult, onFinish, coach }: QuizCardProps) {
  if (view.done || !view.current) return <Done view={view} />;
  return <Live key={`${view.position}:${view.current.id}`} view={view} card={view.current} onResult={onResult} onFinish={onFinish} coach={coach} />;
}

function Live({ view, card, onResult, onFinish, coach }: QuizCardProps & { card: Card }) {
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [answer, setAnswer] = useState("");
  const typed = useRef(false);
  const spoken = useRef(false);
  const answerRef = useRef("");
  const [grade, setGrade] = useState<AiGrade | null>(null);
  const [ending, setEnding] = useState(false);
  const [endFailed, setEndFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Live is keyed by position, so this runs once per card: move focus to each card after the first.
  const later = view.position > 0;
  useEffect(() => {
    if (later) heading.current?.focus();
  }, [later]);

  async function end() {
    const left = view.total - view.position;
    if (
      !(await confirm({
        description: `End the quiz now? ${left} card${left === 1 ? "" : "s"} won't be shown; your marks so far are kept.`,
        destructive: true,
      }))
    ) {
      return;
    }
    setEnding(true);
    setEndFailed(false);
    try {
      await onFinish();
    } catch {
      setEndFailed(true);
    } finally {
      setEnding(false);
    }
  }

  function changeAnswer(value: string, source: "typed" | "voice") {
    if (!value.trim()) typed.current = spoken.current = false;
    else if (source === "voice") spoken.current = true;
    else typed.current = true;
    answerRef.current = value;
    setAnswer(value);
  }

  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const onRecordingChange = useCallback((on: boolean) => {
    recordingRef.current = on;
    setRecording(on);
  }, []);
  const [checking, setChecking] = useState(false);
  const [coachError, setCoachError] = useState("");
  const checkingRef = useRef(false);
  const feedback = grade?.feedback ?? null;

  async function check() {
    if (!coach || checkingRef.current || !answer.trim()) return;
    checkingRef.current = true;
    setChecking(true);
    setCoachError("");
    try {
      const result = await coach.grade(card.id, answer);
      if (result.ok) {
        setGrade(result.value);
        setRevealed(true);
      } else setCoachError(result.error);
    } catch {
      setCoachError("The AI coach failed. Try again.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }
  const busy = useRef(false);

  const mark = useCallback(
    async (result: MarkResult) => {
      if (busy.current || checkingRef.current || recordingRef.current) return;
      busy.current = true;
      setPending(true);
      setFailed(false);
      const text = answerRef.current.trim();
      try {
        await onResult(result, text ? { answer: text, mode: answerModeOf(typed.current, spoken.current) } : undefined);
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [onResult],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (ignoresShortcut(e) || checkingRef.current || recordingRef.current) return;
      if (e.key === " ") {
        if (activatesOnSpace(e.target)) return;
        e.preventDefault();
        setRevealed(true);
        return;
      }
      const result = KEYS[e.key.toLowerCase()];
      if (!result) return;
      if (result !== "skip" && !revealedRef.current) return;
      e.preventDefault();
      void mark(result);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mark]);

  const label = [card.bookTitle, card.partTitle].filter(Boolean).join(" · ");

  return (
    <Card as="section" aria-label="Quiz card" className="shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {view.position + 1} / {view.total}
        </span>
      </div>
      <ProgressBar value={view.position} max={view.total} className="mt-2" />

      <h1 ref={heading} tabIndex={-1} className="mt-5 text-xl font-semibold leading-snug focus-visible:outline-none">
        <Markdown source={card.question} inline />
      </h1>
      {card.prompt && (
        <div className="mt-3">
          <Markdown source={card.prompt} />
        </div>
      )}

      {(!revealed || (coach && !grade)) && (
        <div className="mt-4">
          <AnswerBox
            value={answer}
            onChange={changeAnswer}
            onCheck={coach ? () => void check() : undefined}
            pending={checking}
            onRecordingChange={onRecordingChange}
          />
          {coachError && <Notice className="mt-2">{coachError}</Notice>}
        </div>
      )}

      <div aria-live="polite" className="mt-4 grid gap-4">
        {revealed && !coach && answer.trim() && !feedback && (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm">
            <p className="text-muted-foreground">Your answer</p>
            <p className="mt-1 whitespace-pre-wrap">{answer}</p>
          </div>
        )}
        {grade && <FeedbackPanel feedback={grade.feedback} model={grade.model} />}
        {revealed ? (
          <div className="rounded-lg border border-border bg-background p-4">
            {(coach || answer.trim()) && <p className="mb-2 text-sm text-muted-foreground">Reference answer</p>}
            <Markdown source={card.answer} />
          </div>
        ) : (
          <div>
            <Button type="button" variant="outline" disabled={checking || recording} onClick={() => setRevealed(true)}>
              Show answer
              <KeyHint>Space</KeyHint>
            </Button>
          </div>
        )}
        {revealed && coach && (
          <FollowUpChat
            key={grade?.conversationId ?? "ungraded"}
            opener={feedback?.followUp || undefined}
            conversationId={grade?.conversationId}
            ask={(input) => coach.ask(card.id, { ...input, answer })}
          />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || checking || recording}
            onClick={() => void mark("got")}
            aria-describedby={feedback?.suggested === "got" ? "quiz-suggested" : undefined}
            className={cn("bg-ok text-background hover:bg-ok/85", feedback?.suggested === "got" && suggestedRing)}
          >
            Got it
            <KeyHint>G</KeyHint>
          </Button>
          <Button
            type="button"
            disabled={pending || checking || recording}
            onClick={() => void mark("review")}
            aria-describedby={feedback?.suggested === "review" ? "quiz-suggested" : undefined}
            className={cn("bg-track-1 text-background hover:bg-track-1/85", feedback?.suggested === "review" && suggestedRing)}
          >
            Review
            <KeyHint>R</KeyHint>
          </Button>
          <Button type="button" variant="outline" disabled={pending || checking || recording} onClick={() => void mark("skip")}>
            Skip
            <KeyHint>S</KeyHint>
          </Button>
        </div>
        {feedback && (
          <span id="quiz-suggested" className="text-xs text-muted-foreground">
            Coach suggests: {feedback.suggested === "got" ? "Got it" : "Review"}
          </span>
        )}
        {card.topic && (
          <Link
            href={`/graphs/${encodeURIComponent(card.topic.graphSlug)}?topic=${encodeURIComponent(card.topic.nodeSlug)}`}
            className={chipClass(false, "text-xs text-muted-foreground")}
          >
            Graph topic: {card.topic.title}
          </Link>
        )}
      </div>

      {failed && <Notice className="mt-3">Could not save that answer. Try again.</Notice>}

      {endFailed && <Notice className="mt-3">Could not end the quiz. Try again.</Notice>}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{coach ? "Ctrl+Enter checks your answer. G and R work once the answer is shown." : "G and R work once the answer is shown."}</span>
        <Button type="button" variant="ghost" size="sm" disabled={ending || pending} onClick={() => void end()}>
          {ending ? "Ending…" : "End quiz"}
        </Button>
      </div>
    </Card>
  );
}

function Done({ view }: { view: SessionView }) {
  const stats: [number, string][] = [
    [view.counts.got, "Got it"],
    [view.counts.review, "Review"],
    [view.counts.skip, "Skipped"],
  ];
  return (
    <Card as="section" aria-label="Quiz result" className="p-6 text-center shadow-sm">
      <h1 className="text-2xl font-semibold">Quiz complete</h1>
      <div className="mt-5 flex justify-center gap-8">
        {stats.map(([count, label]) => (
          <div key={label} className="grid">
            <span className="text-3xl font-bold tabular-nums">{count}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/interview" className={buttonVariants()}>
          Back to Interview
        </Link>
        <Link href={`/interview/history/${view.sessionId}`} className={buttonVariants({ variant: "outline" })}>
          Review my answers
        </Link>
      </div>
    </Card>
  );
}
