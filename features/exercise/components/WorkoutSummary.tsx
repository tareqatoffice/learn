"use client";

import Link from "next/link";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEELS, type Feel } from "@/models/exerciseConstants";
import { formatTarget } from "../lib/format";
import { exerciseById } from "../library";
import type { PlanDay } from "../plan";

const LABEL: Record<Feel, string> = { easy: "Easy", ok: "OK", hard: "Hard" };

export function WorkoutSummary({
  plan,
  feels,
  onFeel,
  onFinish,
  saving,
  error,
}: {
  plan: PlanDay;
  feels: Partial<Record<string, Feel>>;
  /** Omit for a finished workout shown read-only. */
  onFeel?(exerciseId: string, feel: Feel): void;
  onFinish?(): void;
  saving?: boolean;
  error?: string;
}) {
  const readOnly = !onFeel;
  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">{readOnly ? "Workout done" : "Nice work"}</h2>
        <p className="text-sm text-muted-foreground">
          {readOnly ? "How each exercise felt." : "How did each exercise feel?"}
        </p>
      </div>
      <ul className="grid gap-3">
        {plan.items.map((item) => {
          const exercise = exerciseById(item.exerciseId);
          const feel = feels[item.exerciseId];
          return (
            <li key={item.exerciseId} className="grid gap-2 rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-medium">
                {exercise?.name ?? item.exerciseId}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {item.sets} × {formatTarget(item)}
                </span>
              </p>
              {readOnly ? (
                <p className="text-sm text-muted-foreground">{feel ? LABEL[feel] : "Not rated"}</p>
              ) : (
                <div role="group" aria-label={`${exercise?.name ?? item.exerciseId} difficulty`} className="flex gap-2">
                  {FEELS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={feel === f}
                      onClick={() => onFeel(item.exerciseId, f)}
                      className={cn(
                        "h-10 flex-1 rounded-lg border text-sm font-medium transition-colors",
                        feel === f ? "border-foreground bg-foreground text-background" : "border-border bg-background",
                      )}
                    >
                      {LABEL[f]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {!readOnly && (
          <Button size="lg" onClick={onFinish} disabled={saving}>
            Finish workout
          </Button>
        )}
        <Link href="/exercise" className={buttonVariants({ variant: readOnly ? "default" : "outline", size: "lg" })}>
          Back to Exercise
        </Link>
      </div>
    </div>
  );
}
