"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { previewGoalAction, saveProfileAction } from "@/app/(app)/exercise/actions";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { TOO_FAR } from "@/features/exercise/goal";
import type { ProfileInput } from "@/features/exercise/profile";
import { LEVELS, SEXES } from "@/models/exerciseConstants";

export const DISCLAIMER = "This is not medical advice. If you have a health condition or injury, check with a doctor before starting.";

type Preview = NonNullable<Awaited<ReturnType<typeof previewGoalAction>>>;

/** JS weekday numbers (0 = Sunday), shown Monday first. */
const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

const LABEL = {
  male: "Male",
  female: "Female",
  unspecified: "Prefer not to say",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive";

type State = {
  heightCm: string;
  birthYear: string;
  sex: ProfileInput["sex"];
  level: ProfileInput["level"];
  workoutDays: number[];
  minutesPerSession: string;
  startWeightKg: string;
  goalWeightKg: string;
  months: string;
};
type TextField = "heightCm" | "birthYear" | "minutesPerSession" | "startWeightKg" | "goalWeightKg" | "months";

const str = (n?: number) => (n === undefined ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

function initialState(initial?: Partial<ProfileInput>): State {
  return {
    heightCm: str(initial?.heightCm),
    birthYear: str(initial?.birthYear),
    sex: initial?.sex ?? "unspecified",
    level: initial?.level ?? "beginner",
    workoutDays: initial?.workoutDays ?? [1, 3, 5],
    minutesPerSession: str(initial?.minutesPerSession ?? 30),
    startWeightKg: str(initial?.startWeightKg),
    goalWeightKg: str(initial?.goalWeightKg),
    months: str(initial?.months ?? 3),
  };
}

function toInput(s: State): ProfileInput {
  return {
    heightCm: num(s.heightCm),
    birthYear: num(s.birthYear),
    sex: s.sex,
    level: s.level,
    workoutDays: s.workoutDays,
    minutesPerSession: num(s.minutesPerSession),
    startWeightKg: num(s.startWeightKg),
    goalWeightKg: num(s.goalWeightKg),
    months: num(s.months),
  };
}

function previewable(i: ProfileInput): boolean {
  return (
    [i.heightCm, i.birthYear, i.startWeightKg, i.goalWeightKg].every(Number.isFinite) &&
    Number.isInteger(i.months) &&
    i.months >= 1 &&
    i.months <= 24 &&
    i.workoutDays.length > 0
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error && <Notice>{error}</Notice>}
    </label>
  );
}

function PreviewNote({ preview }: { preview: Preview }) {
  return (
    <div className="grid gap-1 rounded-xl border border-border bg-card p-4 text-sm" aria-live="polite">
      <p>
        Target date <strong>{preview.targetDate}</strong>, about {Math.abs(preview.pace).toFixed(2)} kg a week.
      </p>
      {preview.check === "warn" && (
        <p className="text-muted-foreground">That is a fast pace (over 0.75 kg a week). More time makes it easier to keep up.</p>
      )}
      {preview.check === "block" &&
        (preview.safeTargetDate ? (
          <Notice>That is faster than 1 kg a week. The earliest safe date is {preview.safeTargetDate}. Choose more months to continue.</Notice>
        ) : (
          <Notice>{TOO_FAR}</Notice>
        ))}
      <p className="text-muted-foreground">About {preview.kcal.toLocaleString("en-US")} kcal a day.</p>
    </div>
  );
}

export const REPLACES_NOTE = "Saving starts a new goal. Your logged weights are kept, and your streak starts again.";

export function SetupForm({ initial, editing = false }: { initial?: Partial<ProfileInput>; editing?: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(() => initialState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    let current = true;
    const input = toInput(s);
    const timer = setTimeout(async () => {
      if (!previewable(input)) {
        setPreview(null);
        return;
      }
      try {
        const res = await previewGoalAction(input);
        if (current) setPreview(res);
      } catch {
        if (current) setPreview(null);
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [s]);

  function update(patch: Partial<State>) {
    setS((prev) => ({ ...prev, ...patch }));
    setErrors({});
  }

  function save() {
    startSave(async () => {
      const res = await saveProfileAction(toInput(s));
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
      router.push("/exercise");
      router.refresh();
    });
  }

  const blocked = preview?.check === "block";
  const text = (field: TextField, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} error={errors[field]}>
      <input
        type="number"
        inputMode="decimal"
        value={s[field]}
        onChange={(e) => update({ [field]: e.target.value })}
        aria-invalid={errors[field] ? true : undefined}
        className={fieldClass}
        {...props}
      />
    </Field>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) save();
      }}
      className="grid gap-5"
    >
      <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">{DISCLAIMER}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        {text("heightCm", "Height (cm)", { min: 120, max: 230 })}
        {text("birthYear", "Birth year", { min: 1900, max: 2100, step: 1 })}
        <Field label="Sex" error={errors.sex}>
          <select value={s.sex} onChange={(e) => update({ sex: e.target.value as State["sex"] })} className={fieldClass}>
            {SEXES.map((v) => (
              <option key={v} value={v}>
                {LABEL[v]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {text("startWeightKg", editing ? "Start weight (kg)" : "Current weight (kg)", { min: 30, max: 300, step: 0.1 })}
        {text("goalWeightKg", "Goal weight (kg)", { min: 30, max: 300, step: 0.1 })}
        {text("months", "Months to reach it", { min: 1, max: 24, step: 1 })}
      </div>

      {preview && <PreviewNote preview={preview} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fitness level" error={errors.level}>
          <select value={s.level} onChange={(e) => update({ level: e.target.value as State["level"] })} className={fieldClass}>
            {LEVELS.map((v) => (
              <option key={v} value={v}>
                {LABEL[v]}
              </option>
            ))}
          </select>
        </Field>
        {text("minutesPerSession", "Minutes per session", { min: 10, max: 60, step: 5 })}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Workout days</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(([n, name]) => (
            <label
              key={n}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring pointer-coarse:py-3"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={s.workoutDays.includes(n)}
                onChange={(e) => update({ workoutDays: e.target.checked ? [...s.workoutDays, n] : s.workoutDays.filter((d) => d !== n) })}
              />
              {name}
            </label>
          ))}
        </div>
        {errors.workoutDays && <Notice>{errors.workoutDays}</Notice>}
      </fieldset>

      {preview?.replaces && <p className="text-sm text-muted-foreground">{REPLACES_NOTE}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving || blocked}>
          Save goal
        </Button>
        {errors._ && <Notice>{errors._}</Notice>}
      </div>
    </form>
  );
}
