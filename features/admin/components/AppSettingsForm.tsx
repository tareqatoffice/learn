"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { saveAppSettingsAction } from "@/app/(app)/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/features/admin/components/fields";
import { SaveBar, inputClass } from "@/features/admin/components/SaveBar";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { type AppSettingsView, FOCUS_PRESETS_MAX, ROTATION_FOCUSES, ROTATION_MAX } from "@/lib/appSettings";
import type { Focus } from "@/models/exerciseConstants";

const FOCUS_LABEL: Record<Focus, string> = {
  full: "Full body",
  upper: "Upper body",
  lower: "Lower body",
  core: "Core",
  cardio: "Cardio",
  stretch: "Stretch",
};

const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

export function AppSettingsForm({ initial }: { initial: AppSettingsView }) {
  const [presets, setPresets] = useState(() => initial.focusPresets.map(String));
  const [rotation, setRotation] = useState<Focus[]>(initial.exerciseRotation);
  const { run, pending, errors, saved, touch } = useAdminAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => saveAppSettingsAction({ focusPresets: presets.map(num), exerciseRotation: rotation }));
  };

  const editPresets = (next: string[]) => {
    touch();
    setPresets(next);
  };
  const editRotation = (next: Focus[]) => {
    touch();
    setRotation(next);
  };

  return (
    <form onSubmit={submit} className="grid gap-6" aria-label="General settings">
      <Field label="Focus timer presets (minutes)" error={errors.focusPresets} group>
        <span className="text-xs text-muted-foreground">
          Session lengths offered by the focus button, next to an open-ended run. Up to {FOCUS_PRESETS_MAX}.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                step={1}
                aria-label={`Preset ${i + 1}`}
                className={`${inputClass} w-20`}
                value={p}
                onChange={(e) => editPresets(presets.map((v, j) => (j === i ? e.target.value : v)))}
              />
              {presets.length > 1 && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove preset ${i + 1}`}
                  onClick={() => editPresets(presets.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              )}
            </span>
          ))}
          {presets.length < FOCUS_PRESETS_MAX && (
            <Button type="button" size="sm" variant="outline" onClick={() => editPresets([...presets, ""])}>
              <Plus /> Add
            </Button>
          )}
        </div>
      </Field>

      <Field label="Workout rotation" error={errors.exerciseRotation} group>
        <span className="text-xs text-muted-foreground">
          The focus of each workout in a week, in order (it repeats when a week has more workouts). In weeks with three or more
          workouts the last one is always a stretch, and people aiming to gain weight get full body instead of cardio.
        </span>
        <ol className="grid gap-2">
          {rotation.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 text-right text-sm text-muted-foreground">{i + 1}.</span>
              <select
                aria-label={`Workout ${i + 1} focus`}
                className={`${inputClass} max-w-48`}
                value={f}
                onChange={(e) => editRotation(rotation.map((v, j) => (j === i ? (e.target.value as Focus) : v)))}
              >
                {ROTATION_FOCUSES.map((o) => (
                  <option key={o} value={o}>
                    {FOCUS_LABEL[o]}
                  </option>
                ))}
              </select>
              {rotation.length > 1 && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove workout ${i + 1}`}
                  onClick={() => editRotation(rotation.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ol>
        {rotation.length < ROTATION_MAX && (
          <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => editRotation([...rotation, "full"])}>
            <Plus /> Add workout
          </Button>
        )}
      </Field>

      <SaveBar label="Save settings" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
