"use client";

import { useCallback, useEffect, useState } from "react";
import { finishSessionAction, saveSetAction } from "@/app/(app)/exercise/actions";
import { Button } from "@/components/ui/button";
import type { Feel } from "@/models/exerciseConstants";
import { formatTarget } from "../lib/format";
import { usePlayer, type PlayerStart, type SetSave } from "../lib/usePlayer";
import { exerciseById } from "../library";
import type { PlanDay } from "../plan";
import { ExerciseFrames } from "./ExerciseFrames";
import { RestScreen } from "./RestScreen";
import { WorkoutSummary } from "./WorkoutSummary";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Saves never block the workout: one retry, then the set is left for the next save to correct. */
async function persist(date: string, { index, action }: SetSave) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await saveSetAction(date, index, action);
      return;
    } catch {
      // retry once
    }
  }
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => {
        if (cancelled) void l.release().catch(() => {});
        else lock = l;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

export function WorkoutPlayer({
  date,
  plan,
  start,
}: {
  date: string;
  plan: PlanDay;
  /** The first set still to do; an item index past the end opens the summary. */
  start: PlayerStart;
}) {
  const onSave = useCallback((save: SetSave) => void persist(date, save), [date]);
  const player = usePlayer(plan, start, onSave);
  const { dispatch } = player;
  const [feels, setFeels] = useState<Partial<Record<string, Feel>>>({});
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string>();

  useWakeLock(player.phase !== "summary");

  async function finish() {
    setFinishing(true);
    setError(undefined);
    try {
      await finishSessionAction(date, feels as Record<string, Feel>);
      setFinished(true);
    } catch {
      setError("Could not save the workout. Try again.");
    } finally {
      setFinishing(false);
    }
  }

  if (player.phase === "summary") {
    return finished ? (
      <WorkoutSummary plan={plan} feels={feels} />
    ) : (
      <WorkoutSummary
        plan={plan}
        feels={feels}
        onFeel={(id, feel) => setFeels((f) => ({ ...f, [id]: feel }))}
        onFinish={finish}
        saving={finishing}
        error={error}
      />
    );
  }

  const total = plan.items.length;
  const item = plan.items[player.item];
  const exercise = exerciseById(item.exerciseId);
  if (!exercise) return <p>This exercise is no longer available.</p>;

  const setsTotal = plan.items.reduce((n, i) => n + i.sets, 0);
  const setsBefore = plan.items.slice(0, player.item).reduce((n, i) => n + i.sets, 0) + player.set;

  if (player.phase === "rest") {
    return (
      <RestScreen
        remaining={player.remaining}
        next={exercise}
        nextItem={item}
        onAdd={() => dispatch({ type: "addRest", sec: 15 })}
        onSkip={() => dispatch({ type: "skipRest" })}
      />
    );
  }

  return (
    <div className="grid gap-5 text-center">
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          {cap(plan.focus)} · {player.item + 1} of {total}
        </p>
        <div
          role="progressbar"
          aria-label="Workout progress"
          aria-valuemin={0}
          aria-valuemax={setsTotal}
          aria-valuenow={setsBefore}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full bg-[var(--t-6)] transition-[width]" style={{ width: `${(setsBefore / setsTotal) * 100}%` }} />
        </div>
      </div>
      <ExerciseFrames exercise={exercise} size="lg" />
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold">{exercise.name}</h2>
        <p className="text-5xl font-semibold tabular-nums">
          {item.seconds ? formatTarget({ seconds: player.remaining }) : formatTarget(item)}
        </p>
        <p className="text-sm text-muted-foreground">
          Set {player.set + 1} of {item.sets}
        </p>
      </div>
      {exercise.cues[0] && <p className="text-sm text-muted-foreground">{exercise.cues[0]}</p>}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Button variant="outline" size="lg" onClick={() => dispatch({ type: "back" })}>
          Back
        </Button>
        <Button size="lg" className="h-14 text-base" onClick={() => dispatch({ type: "done" })}>
          Done set
        </Button>
        <Button variant="ghost" size="lg" onClick={() => dispatch({ type: "skip" })}>
          Skip
        </Button>
      </div>
    </div>
  );
}
