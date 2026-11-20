"use client";

import { useState } from "react";
import { startQuizAction } from "@/app/(app)/interview/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isNavigationError, START_FAILED } from "@/lib/navigationError";

export function StartReviewButton({
  disabled,
  variant,
  size,
  className,
}: {
  className?: string;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [starting, setStarting] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setStarting(true);
    setEmpty(false);
    setFailed(false);
    try {
      const result = await startQuizAction({ mode: "review", bookIds: [], partKeys: [], size: 20 });
      if (result?.empty) setEmpty(true);
    } catch (error) {
      if (isNavigationError(error)) throw error;
      setFailed(true);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button onClick={start} disabled={disabled || starting} variant={variant} size={size} className={cn("justify-self-start", className)}>
        Start review quiz
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {START_FAILED}
        </p>
      )}
      {empty && (
        <p role="status" className="text-sm text-muted-foreground">
          Nothing to review right now.
        </p>
      )}
    </div>
  );
}
