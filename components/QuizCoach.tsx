"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AI_ANSWER_MAX, AI_MESSAGE_MAX } from "@/lib/ai-limits";
import { useSpeechInput } from "@/lib/useSpeechInput";
import { Markdown } from "@/lib/markdown/Markdown";
import { cn } from "@/lib/utils";
import type { AiChatMessage, AiFeedback, AiReply, AiResult, AiVerdict } from "@/progress/quizAi";
import { Notice } from "@/components/Notice";

const fieldClass =
  "w-full rounded-lg border border-border bg-background p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring read-only:opacity-60";

const isSubmitChord = (e: React.KeyboardEvent) => e.key === "Enter" && (e.ctrlKey || e.metaKey);

/** Appends a dictated phrase to the answer, with a space between it and what is already there. */
export function appendSpoken(current: string, phrase: string): string {
  const joined = current && !/\s$/.test(current) ? `${current} ${phrase}` : current + phrase;
  return joined.slice(0, AI_ANSWER_MAX);
}

/**
 * Where the learner writes or dictates an answer before revealing. With a coach, Ctrl/Cmd+Enter
 * (or the button) checks it; `onChange` says whether the new text was typed or spoken.
 */
export function AnswerBox({
  value,
  onChange,
  onCheck,
  pending = false,
  onRecordingChange,
}: {
  value: string;
  onChange: (value: string, source: "typed" | "voice") => void;
  onCheck?: () => void;
  pending?: boolean;
  /** Told when dictation starts and stops, so the card can hold marks until the last phrase is in. */
  onRecordingChange?: (recording: boolean) => void;
}) {
  // The latest value, so a phrase that finishes after a keystroke appends to the current text.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const speech = useSpeechInput((phrase) => {
    const next = appendSpoken(valueRef.current, phrase);
    valueRef.current = next;
    onChange(next, "voice");
  });
  useEffect(() => {
    onRecordingChange?.(speech.listening);
  }, [speech.listening, onRecordingChange]);
  // Checking mid-dictation would grade the answer without the phrase still being spoken.
  const canCheck = Boolean(value.trim()) && !pending && !speech.listening;
  const check = () => {
    if (canCheck) onCheck?.();
  };

  return (
    <div className="grid gap-2">
      <label htmlFor="quiz-answer" className="text-sm text-muted-foreground">
        Your answer
      </label>
      <textarea
        id="quiz-answer"
        rows={4}
        maxLength={AI_ANSWER_MAX}
        value={value}
        // Read-only rather than disabled: a disabled box drops focus to <body>, where Space and G/R/S are shortcuts.
        readOnly={pending}
        aria-busy={pending}
        placeholder={
          onCheck
            ? "Answer as you would in an interview (write or speak), then let the AI coach check it."
            : "Answer as you would in an interview (write or speak), then show the answer."
        }
        onChange={(e) => onChange(e.target.value, "typed")}
        onKeyDown={(e) => {
          if (onCheck && isSubmitChord(e)) {
            e.preventDefault();
            check();
          }
        }}
        className={fieldClass}
      />
      {speech.listening && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          <span aria-hidden className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-destructive align-middle" />
          Listening… {speech.interim && <span className="italic">{speech.interim}</span>}
          <span className="block text-xs">Stop recording to show, check or mark the answer.</span>
        </p>
      )}
      {speech.supported && !speech.listening && (
        <p className="text-xs text-muted-foreground">
          Voice answers are transcribed by your browser&apos;s speech service (in Chrome, Google&apos;s servers).
        </p>
      )}
      {speech.error && <Notice>{speech.error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {speech.supported && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            aria-pressed={speech.listening}
            onClick={speech.listening ? speech.stop : speech.start}
          >
            {speech.listening ? <MicOff aria-hidden /> : <Mic aria-hidden />}
            {speech.listening ? "Stop recording" : "Answer by voice"}
          </Button>
        )}
        {onCheck && (
          <Button type="button" disabled={!canCheck} onClick={check}>
            {pending ? "Checking…" : "Check with AI"}
            {!pending && <kbd className="ml-1 rounded border border-current/30 px-1 text-xs opacity-80">Ctrl+Enter</kbd>}
          </Button>
        )}
      </div>
    </div>
  );
}

const VERDICT: Record<AiVerdict, { label: string; className: string }> = {
  correct: { label: "Correct", className: "border-ok/40 bg-ok/10 text-ok" },
  partial: { label: "Partly right", className: "border-track-1/40 bg-track-1/10 text-track-1" },
  incorrect: { label: "Not quite", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

export function FeedbackPanel({ feedback, model }: { feedback: AiFeedback; model?: string }) {
  const verdict = VERDICT[feedback.verdict];
  return (
    <section aria-label="AI feedback" className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2.5 py-0.5 text-sm font-medium", verdict.className)}>
          {verdict.label}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">{feedback.score} / 100</span>
      </div>
      <p className="mt-3 text-sm">{feedback.summary}</p>
      <FeedbackList title="What you got right" items={feedback.strengths} />
      <FeedbackList title="What to add or fix" items={feedback.missing} />
      {model && <p className="mt-3 text-xs text-muted-foreground">Checked by {model}</p>}
    </section>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A short conversation with the coach about the card. The server keeps the history; the chat only
 * sends the new message and the conversation id. When grading produced a follow-up question, the
 * chat opens with it (it is already the conversation's first message on the server).
 */
export function FollowUpChat({
  opener,
  conversationId: initialId,
  ask,
}: {
  opener?: string;
  conversationId?: string;
  ask: (input: { conversationId?: string; message: string }) => Promise<AiResult<AiReply>>;
}) {
  const [messages, setMessages] = useState<AiChatMessage[]>(opener ? [{ role: "assistant", content: opener }] : []);
  const [conversationId, setConversationId] = useState(initialId);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(Boolean(opener));
  const busy = useRef(false);

  async function send() {
    const content = draft.trim();
    if (!content || busy.current) return;
    busy.current = true;
    const before = messages;
    setMessages([...before, { role: "user", content }]);
    setDraft("");
    setPending(true);
    setError("");
    try {
      const result = await ask({ conversationId, message: content });
      if (!result.ok) throw new Error(result.error);
      setConversationId(result.value.conversationId);
      setMessages([...before, { role: "user", content }, { role: "assistant", content: result.value.reply }]);
    } catch (e) {
      setMessages(before);
      setDraft(content);
      setError(e instanceof Error && e.message ? e.message : "The AI coach failed. Try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Ask the AI coach a follow-up
      </Button>
    );
  }

  return (
    <section aria-label="Follow-up with the AI coach" className="grid gap-3 rounded-lg border border-border bg-background p-4">
      <h2 className="text-sm font-medium">Follow-up</h2>
      {messages.length > 0 && (
        <ol aria-live="polite" className="grid gap-2">
          {messages.map((m, i) => (
            <li
              key={i}
              className={cn(
                "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                m.role === "user" ? "justify-self-end bg-muted" : "justify-self-start border border-border",
              )}
            >
              <span className="sr-only">{m.role === "user" ? "You: " : "Coach: "}</span>
              {m.role === "assistant" ? <Markdown source={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
            </li>
          ))}
          {pending && <li className="text-sm text-muted-foreground">Coach is thinking…</li>}
        </ol>
      )}
      <label htmlFor="quiz-followup" className="sr-only">
        Message the AI coach
      </label>
      <textarea
        id="quiz-followup"
        rows={2}
        maxLength={AI_MESSAGE_MAX}
        value={draft}
        readOnly={pending}
        placeholder={messages.length ? "Answer the coach or ask something else…" : "Ask about this question…"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitChord(e)) {
            e.preventDefault();
            void send();
          }
        }}
        className={fieldClass}
      />
      <div>
        <Button type="button" size="sm" disabled={pending || !draft.trim()} onClick={() => void send()}>
          Send
        </Button>
      </div>
      {error && <Notice>{error}</Notice>}
    </section>
  );
}
