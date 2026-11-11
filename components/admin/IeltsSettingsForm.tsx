"use client";

import { useState } from "react";
import { saveIeltsSettingsAction } from "@/app/(app)/admin/ielts/settings/actions";
import { Field } from "@/components/admin/fields";
import { SaveBar, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import type { IeltsSettingsView } from "@/ielts/settings";

type Texts = Record<string, string>;

const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

const SPLIT: { key: keyof IeltsSettingsView["split"]; label: string }[] = [
  { key: "foundation", label: "Foundation %" },
  { key: "skills", label: "Skills %" },
  { key: "mocks", label: "Mocks %" },
];

const THRESHOLDS: { key: keyof IeltsSettingsView["thresholds"]; label: string; help: string; step: number }[] = [
  { key: "missedShare", label: "Missed share (0 to 1)", help: "Suggest a lighter plan when this share of planned days was missed.", step: 0.05 },
  { key: "missedStreak", label: "Missed streak (days)", help: "Or when this many planned days in a row were missed.", step: 1 },
  { key: "weakGap", label: "Weak skill gap (bands)", help: "A skill this far below the target band counts as weak.", step: 0.5 },
  { key: "shiftShare", label: "Shift share (0 to 1)", help: "How much of the plan to move towards a weak skill.", step: 0.05 },
  { key: "currentBandGap", label: "Current band gap (bands)", help: "Suggest updating the current band when practice results differ by this much.", step: 0.5 },
  { key: "dismissDays", label: "Dismiss for (days)", help: "How long a dismissed suggestion stays hidden.", step: 1 },
];

export function IeltsSettingsForm({ initial }: { initial: IeltsSettingsView }) {
  const [hours, setHours] = useState(String(initial.hoursPerBand));
  const [split, setSplit] = useState<Texts>(() => Object.fromEntries(SPLIT.map((s) => [s.key, String(initial.split[s.key])])));
  const [thresholds, setThresholds] = useState<Texts>(() =>
    Object.fromEntries(THRESHOLDS.map((t) => [t.key, String(initial.thresholds[t.key])])),
  );
  const { run, pending, errors, saved, touch } = useAdminAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      saveIeltsSettingsAction({
        hoursPerBand: num(hours),
        split: { foundation: num(split.foundation), skills: num(split.skills), mocks: num(split.mocks) },
        thresholds: Object.fromEntries(THRESHOLDS.map((t) => [t.key, num(thresholds[t.key])])),
      }),
    );
  };

  const total = SPLIT.reduce((sum, s) => sum + (num(split[s.key]) || 0), 0);

  return (
    <form onSubmit={submit} className="grid gap-5" aria-label="IELTS settings">
      <Field label="Hours per band" error={errors.hoursPerBand}>
        <input
          type="number"
          min={1}
          step="any"
          className={`${inputClass} max-w-40`}
          value={hours}
          onChange={(e) => {
            touch();
            setHours(e.target.value);
          }}
        />
        <span className="text-xs text-muted-foreground">rough guide, not an official figure</span>
      </Field>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Plan phases</legend>
        <div className="flex flex-wrap gap-3">
          {SPLIT.map((s) => (
            <Field key={s.key} label={s.label} error={errors[`split.${s.key}`]}>
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                className={`${inputClass} w-28`}
                value={split[s.key]}
                onChange={(e) => {
                  touch();
                  setSplit((d) => ({ ...d, [s.key]: e.target.value }));
                }}
              />
            </Field>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Adds up to {total} of 100.</span>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Suggestion thresholds</legend>
        {THRESHOLDS.map((t) => (
          <Field key={t.key} label={t.label} error={errors[`thresholds.${t.key}`]}>
            <input
              type="number"
              min={0}
              step={t.step}
              className={`${inputClass} max-w-40`}
              value={thresholds[t.key]}
              onChange={(e) => {
                touch();
                setThresholds((d) => ({ ...d, [t.key]: e.target.value }));
              }}
            />
            <span className="text-xs text-muted-foreground">{t.help}</span>
          </Field>
        ))}
      </fieldset>

      <SaveBar label="Save settings" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
