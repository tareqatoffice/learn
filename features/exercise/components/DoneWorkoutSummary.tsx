"use client";

import { useState } from "react";
import { finishSessionAction } from "@/app/(app)/exercise/actions";
import type { Feel } from "@/models/exerciseConstants";
import type { PlanDay } from "../plan";
import { WorkoutSummary } from "./WorkoutSummary";

/** A done session opened later: still rateable until feels have been saved, read-only after. */
export function DoneWorkoutSummary({
  date,
  today,
  plan,
  initialFeels,
  skipped,
}: {
  date: string;
  /** The user's current day: only that day's workout can still be rated. */
  today: string;
  plan: PlanDay;
  initialFeels: Partial<Record<string, Feel>>;
  skipped: string[];
}) {
  const [editable, setEditable] = useState(date === today && Object.keys(initialFeels).length === 0);
  const [feels, setFeels] = useState(initialFeels);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (!editable) return <WorkoutSummary plan={plan} feels={feels} skipped={skipped} />;

  async function finish() {
    setSaving(true);
    setError(undefined);
    try {
      await finishSessionAction(date, feels as Record<string, Feel>);
      setEditable(false);
    } catch {
      setError("Could not save the workout. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkoutSummary
      plan={plan}
      feels={feels}
      skipped={skipped}
      onFeel={(id, feel) => setFeels((f) => ({ ...f, [id]: feel }))}
      onFinish={finish}
      saving={saving}
      error={error}
    />
  );
}
