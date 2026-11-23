"use client";

import { Button } from "@/components/ui/button";
import { formatTarget, formatClock } from "../lib/format";
import type { Exercise } from "../library";
import type { PlanItem } from "../plan";
import { ExerciseFrames } from "./ExerciseFrames";

export function RestScreen({
  remaining,
  next,
  nextItem,
  onAdd,
  onSkip,
}: {
  remaining: number;
  next: Exercise;
  nextItem: PlanItem;
  onAdd(): void;
  onSkip(): void;
}) {
  return (
    <div className="grid justify-items-center gap-5 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Rest</p>
      <p className="text-6xl font-semibold tabular-nums" aria-live="off">
        {formatClock(remaining)}
      </p>
      <div className="grid w-full justify-items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Up next: {next.name} · {formatTarget(nextItem)}
        </p>
        <ExerciseFrames exercise={next} size="sm" />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onAdd}>
          +15s
        </Button>
        <Button data-primary onClick={onSkip}>
          Skip rest
        </Button>
      </div>
    </div>
  );
}
