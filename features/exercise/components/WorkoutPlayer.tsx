"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { finishSessionAction, saveSetAction } from "@/app/(app)/exercise/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Feel } from "@/models/exerciseConstants";
import { formatTarget } from "../lib/format";
import { usePlayer, type PlayerStart, type SetSave } from "../lib/usePlayer";
import { exerciseById } from "../library";
import type { PlanDay } from "../plan";
import { ExerciseFrames } from "./ExerciseFrames";
import { RestScreen } from "./RestScreen";
import { WorkoutSummary } from "./WorkoutSummary";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One save with a single retry; never throws, so a failure cannot stall the queue behind it. */
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

/** Holds the screen awake while playing; the browser drops the lock when the tab is hidden, so ask again on return. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    const acquire = () => {
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (cancelled) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!lock || lock.released)) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
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
  // Saves run one after another so a retried set can never land after a later one.
  // An idle queue starts the save at once; a busy one appends to the chain.
  const tail = useRef<Promise<void> | null>(null);
  const onSave = useCallback(
    (save: SetSave) => {
      const run = tail.current ? tail.current.then(() => persist(date, save)) : persist(date, save);
      const mine: Promise<void> = run.finally(() => {
        if (tail.current === mine) tail.current = null;
      });
      tail.current = mine;
    },
    [date],
  );
  const player = usePlayer(plan, start, onSave);
  const { dispatch } = player;
  const [feels, setFeels] = useState<Partial<Record<string, Feel>>>({});
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string>();

  useWakeLock(player.phase !== "summary");

  // After a phase change the main action is the next thing to press, so keep focus there.
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(`${player.phase}/${player.item}/${player.set}`);
  useEffect(() => {
    const now = `${player.phase}/${player.item}/${player.set}`;
    if (seen.current === now) return;
    seen.current = now;
    root.current?.querySelector<HTMLElement>("[data-primary]")?.focus();
  }, [player.phase, player.item, player.set]);

  async function finish() {
    setFinishing(true);
    setError(undefined);
    try {
      // Pending set saves land first, so the session is complete when it is finished.
      await tail.current;
      await finishSessionAction(date, feels as Record<string, Feel>);
      setFinished(true);
    } catch {
      setError("Could not save the workout. Try again.");
    } finally {
      setFinishing(false);
    }
  }

  const live = (text: string, body: React.ReactNode) => (
    <div ref={root}>
      <p role="status" aria-live="polite" className="sr-only">
        {text}
      </p>
      {body}
    </div>
  );

  if (player.phase === "summary") {
    // Every exercise skipped: the server counted nothing, so there is nothing to rate.
    if (!player.done.some((n) => n > 0)) {
      return (
        <div className="grid gap-5">
          <p role="status" className="text-lg font-semibold">
            Workout skipped — it doesn&apos;t count toward your streak.
          </p>
          <div>
            <Link href="/exercise" className={buttonVariants({ size: "lg" })}>
              Back to Exercise
            </Link>
          </div>
        </div>
      );
    }
    const skipped = plan.items.flatMap((it, i) => (player.skipped[i] ? [it.exerciseId] : []));
    return finished ? (
      <WorkoutSummary plan={plan} feels={feels} skipped={skipped} />
    ) : (
      <WorkoutSummary
        plan={plan}
        feels={feels}
        skipped={skipped}
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
  if (!exercise) {
    return (
      <div className="grid gap-4 text-center">
        <p>This exercise is no longer available.</p>
        <Button
          size="lg"
          onClick={() => {
            // A rest in front of the missing move has to end before it can be skipped.
            if (player.phase === "rest") dispatch({ type: "skipRest" });
            dispatch({ type: "skip" });
          }}
        >
          Skip
        </Button>
      </div>
    );
  }

  const setsTotal = plan.items.reduce((n, i) => n + i.sets, 0);
  const setsBefore = plan.items.slice(0, player.item).reduce((n, i) => n + i.sets, 0) + player.set;

  if (player.phase === "rest") {
    return live(
      `Rest. Up next: ${exercise.name}, set ${player.set + 1} of ${item.sets}`,
      <RestScreen
        remaining={player.remaining}
        next={exercise}
        nextItem={item}
        onAdd={() => dispatch({ type: "addRest", sec: 15 })}
        onSkip={() => dispatch({ type: "skipRest" })}
      />,
    );
  }

  return live(
    `${exercise.name}, set ${player.set + 1} of ${item.sets}`,
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
        <Button size="lg" data-primary className="h-14 text-base" onClick={() => dispatch({ type: "done" })}>
          Done set
        </Button>
        <Button variant="ghost" size="lg" onClick={() => dispatch({ type: "skip" })}>
          Skip
        </Button>
      </div>
    </div>,
  );
}
