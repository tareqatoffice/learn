"use client";

import { useState } from "react";
import { startQuizAction } from "@/app/(app)/interview/actions";
import { Button } from "@/components/ui/button";

/** Starts a 20-card quiz from the review pile across every book; the action redirects into it. */
export function StartReviewButton({ disabled }: { disabled?: boolean }) {
  const [starting, setStarting] = useState(false);
  const [empty, setEmpty] = useState(false);

  async function start() {
    setStarting(true);
    setEmpty(false);
    try {
      const result = await startQuizAction({ mode: "review", bookIds: [], partKeys: [], size: 20 });
      if (result?.empty) setEmpty(true);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button onClick={start} disabled={disabled || starting} className="justify-self-start">
        Start review quiz
      </Button>
      {empty && (
        <p role="status" className="text-sm text-muted-foreground">
          Nothing to review right now.
        </p>
      )}
    </div>
  );
}
