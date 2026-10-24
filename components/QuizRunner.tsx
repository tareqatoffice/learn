"use client";

import { useState, useTransition } from "react";
import { finishQuizAction, recordResultAction } from "@/app/(app)/interview/actions";
import { QuizCard } from "@/components/QuizCard";
import type { MarkResult } from "@/progress/questions";
import type { SessionView } from "@/progress/quiz";

/** Connects a quiz session to the Server Actions; the card itself only knows callbacks. */
export function QuizRunner({ initial }: { initial: SessionView }) {
  const [view, setView] = useState(initial);
  const [, startTransition] = useTransition();

  async function onResult(result: MarkResult): Promise<SessionView> {
    if (!view.current) return view;
    const next = await recordResultAction(view.sessionId, view.current.id, result);
    setView(next);
    return next;
  }

  function onFinish() {
    startTransition(async () => {
      await finishQuizAction(view.sessionId);
      setView((v) => ({ ...v, done: true, current: null }));
    });
  }

  return <QuizCard view={view} onResult={onResult} onFinish={onFinish} />;
}
