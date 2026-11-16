"use client";

import { useState, useTransition } from "react";
import { discardQuizAction } from "@/app/(app)/interview/actions";

/** Takes an unfinished quiz off the list after a confirm; its answers stay in history. */
export function DiscardQuizButton({ sessionId, label }: { sessionId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-label={`Discard ${label}`}
        onClick={() => {
          if (!window.confirm(`Discard "${label}"? Any answers you gave stay in your quiz history.`)) return;
          setFailed(false);
          startTransition(async () => {
            try {
              await discardQuizAction(sessionId);
            } catch {
              setFailed(true);
            }
          });
        }}
        className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        {pending ? "Discarding…" : "Discard"}
      </button>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          Couldn&apos;t discard. Try again.
        </span>
      )}
    </>
  );
}
