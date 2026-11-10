"use client";

import { useState, useTransition } from "react";
import {
  askFollowUpAction,
  finishQuizAction,
  gradeAnswerAction,
  recordResultAction,
} from "@/app/(app)/interview/actions";
import { type QuizCoach, QuizCard } from "@/components/QuizCard";
import type { QuizAttempt } from "@/lib/quiz-answer";
import type { MarkResult } from "@/progress/questions";
import type { SessionView } from "@/progress/quiz";

/** Connects a quiz session to the Server Actions; the card itself only knows callbacks. */
export function QuizRunner({ initial, aiEnabled = false }: { initial: SessionView; aiEnabled?: boolean }) {
  const [view, setView] = useState(initial);
  const [, startTransition] = useTransition();

  async function onResult(result: MarkResult, attempt?: QuizAttempt): Promise<SessionView> {
    if (!view.current) return view;
    const next = await recordResultAction(view.sessionId, view.current.id, result, attempt);
    setView(next);
    return next;
  }

  function onFinish() {
    startTransition(async () => {
      await finishQuizAction(view.sessionId);
      setView((v) => ({ ...v, done: true, current: null }));
    });
  }

  const coach: QuizCoach | undefined = aiEnabled
    ? {
        grade: (questionId, answer) => gradeAnswerAction(view.sessionId, questionId, answer),
        ask: (questionId, input) => askFollowUpAction(view.sessionId, questionId, input),
      }
    : undefined;

  return <QuizCard view={view} onResult={onResult} onFinish={onFinish} coach={coach} />;
}
