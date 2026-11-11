"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { previewProfileAction, saveProfileAction } from "@/app/(app)/ielts/actions";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { SKILLS } from "@/ielts/bands";
import type { PlanPreview as Preview, ProfileInput, ProfileView } from "@/ielts/profile";
import { HoursWarning } from "./HoursWarning";
import { PlanPreview } from "./PlanPreview";
import { SKILL_LABEL, bandLabel } from "./format";

const BANDS = Array.from({ length: 11 }, (_, i) => 4 + i / 2);
// Monday first; the values are weekday numbers with 0 = Sunday.
const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive";

type Skill = (typeof SKILLS)[number];
type State = {
  testDate: string;
  target: string;
  current: string;
  skillTarget: Record<Skill, string>;
  skillCurrent: Record<Skill, string>;
  minutes: string;
  days: number[];
  examinerVoice: boolean;
  mockVideo: boolean;
  drillVideo: boolean;
};

const blankSkills = (): Record<Skill, string> => ({ listening: "", reading: "", writing: "", speaking: "" });
const str = (n?: number) => (n === undefined ? "" : String(n));

function initialState(initial: ProfileView | undefined, today: string): State {
  const skills = (b: Partial<Record<Skill, number>> | undefined) =>
    Object.fromEntries(SKILLS.map((s) => [s, str(b?.[s])])) as Record<Skill, string>;
  return {
    testDate: initial && initial.testDate > today ? initial.testDate : "",
    target: str(initial?.target.overall),
    current: str(initial?.current.overall),
    skillTarget: initial ? skills(initial.target) : blankSkills(),
    skillCurrent: initial ? skills(initial.current) : blankSkills(),
    minutes: String(initial?.minutesPerDay ?? 60),
    days: initial?.studyDays ?? [0, 1, 2, 3, 4, 5, 6],
    examinerVoice: initial?.examinerVoice ?? true,
    mockVideo: initial?.mockVideo ?? true,
    drillVideo: initial?.drillVideo ?? false,
  };
}

function toInput(s: State): ProfileInput {
  const skills = (m: Record<Skill, string>) => Object.fromEntries(SKILLS.filter((k) => m[k] !== "").map((k) => [k, Number(m[k])]));
  return {
    testDate: s.testDate,
    target: { overall: Number(s.target), ...skills(s.skillTarget) },
    current: { ...(s.current !== "" ? { overall: Number(s.current) } : {}), ...skills(s.skillCurrent) },
    minutesPerDay: s.minutes.trim() === "" ? Number.NaN : Number(s.minutes),
    studyDays: s.days,
    examinerVoice: s.examinerVoice,
    mockVideo: s.mockVideo,
    drillVideo: s.drillVideo,
  };
}

function BandSelect({
  label,
  value,
  onChange,
  blank,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  blank?: string;
  invalid?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid ? true : undefined} className={fieldClass}>
        <option value="">{blank ?? "Choose"}</option>
        {BANDS.map((b) => (
          <option key={b} value={b}>
            {bandLabel(b)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Setup (no `initial`) and profile edits. Saving always goes through a before/after preview of the
 * rebuilt plan, including standing changes it would drop; editing any field after a preview clears it.
 */
export function ProfileForm({ today, initial }: { today: string; initial?: ProfileView }) {
  const router = useRouter();
  const [s, setS] = useState(() => initialState(initial, today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, start] = useTransition();

  function update(patch: Partial<State>) {
    setS((prev) => ({ ...prev, ...patch }));
    setPreview(null);
    setErrors({});
  }

  function runPreview() {
    if (s.target === "") {
      setErrors({ target: "Pick a target band." });
      return;
    }
    setErrors({});
    start(async () => {
      const res = await previewProfileAction(toInput(s));
      if (!res.ok) {
        setPreview(null);
        setErrors(res.errors);
        return;
      }
      setPreview({ before: res.before, after: res.after, dropped: res.dropped });
    });
  }

  function save() {
    start(async () => {
      const res = await saveProfileAction(toInput(s));
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
      router.push("/ielts");
      router.refresh();
    });
  }

  const formError = errors._ ?? Object.entries(errors).find(([k]) => !["testDate", "target", "minutesPerDay", "studyDays"].includes(k))?.[1];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        runPreview();
      }}
      className="grid gap-5"
    >
      <label className="grid max-w-xs gap-1.5 text-sm font-medium">
        Test date
        <input
          type="date"
          value={s.testDate}
          min={today}
          onChange={(e) => update({ testDate: e.target.value })}
          aria-invalid={errors.testDate ? true : undefined}
          className={fieldClass}
        />
        {errors.testDate && <Notice>{errors.testDate}</Notice>}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <BandSelect label="Target band (overall)" value={s.target} onChange={(v) => update({ target: v })} invalid={Boolean(errors.target)} />
          {errors.target && <Notice>{errors.target}</Notice>}
        </div>
        <BandSelect label="Current band (overall)" value={s.current} onChange={(v) => update({ current: v })} blank="I don't know" />
      </div>
      {s.current === "" && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Without a current band, the plan assumes one band below your target and adds a Speaking mock in week 1.
        </p>
      )}

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Per-skill bands (optional)</summary>
        <p className="mt-2 text-xs text-muted-foreground">Left blank, a skill uses the overall figures. Setting them gives the weaker skills more time.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SKILLS.map((k) => (
            <div key={k} className="grid grid-cols-2 gap-2">
              <BandSelect
                label={`${SKILL_LABEL[k]} target`}
                value={s.skillTarget[k]}
                onChange={(v) => update({ skillTarget: { ...s.skillTarget, [k]: v } })}
                blank="Same as overall"
              />
              <BandSelect
                label={`${SKILL_LABEL[k]} current`}
                value={s.skillCurrent[k]}
                onChange={(v) => update({ skillCurrent: { ...s.skillCurrent, [k]: v } })}
                blank="Same as overall"
              />
            </div>
          ))}
        </div>
      </details>

      <label className="grid max-w-xs gap-1.5 text-sm font-medium">
        Minutes per day
        <input
          type="number"
          inputMode="numeric"
          min={10}
          max={480}
          value={s.minutes}
          onChange={(e) => update({ minutes: e.target.value })}
          aria-invalid={errors.minutesPerDay ? true : undefined}
          className={fieldClass}
        />
        {errors.minutesPerDay && <Notice>{errors.minutesPerDay}</Notice>}
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Study days</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(([n, name]) => (
            <label
              key={n}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring pointer-coarse:py-3"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={s.days.includes(n)}
                onChange={(e) => update({ days: e.target.checked ? [...s.days, n] : s.days.filter((d) => d !== n) })}
              />
              {name}
            </label>
          ))}
        </div>
        {errors.studyDays && <Notice>{errors.studyDays}</Notice>}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Speaking practice</legend>
        {(
          [
            ["examinerVoice", "Read questions aloud (examiner voice)"],
            ["mockVideo", "Record video in mocks"],
            ["drillVideo", "Record video in drills"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s[key]} onChange={(e) => update({ [key]: e.target.checked })} className="size-4" />
            {label}
          </label>
        ))}
      </fieldset>

      {!preview && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            Preview plan
          </Button>
          {formError && <Notice>{formError}</Notice>}
        </div>
      )}

      {preview && (
        <section aria-labelledby="preview-title" className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <h2 id="preview-title" className="text-sm font-semibold">
            {preview.before ? "How your plan would change" : "Your plan"}
          </h2>
          <PlanPreview {...preview} />
          {preview.after.hours.short && <HoursWarning needed={preview.after.hours.needed} available={preview.after.hours.available} profileHref={null} />}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={pending} onClick={save}>
              Save plan
            </Button>
            <p className="text-xs text-muted-foreground">Nothing is saved until you do.</p>
            {formError && <Notice>{formError}</Notice>}
          </div>
        </section>
      )}
    </form>
  );
}
