"use client";

import { useState } from "react";
import { saveDefaultsAction } from "@/app/(app)/admin/speaking/actions";
import { Field } from "@/components/admin/fields";
import { SaveBar, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { TASKS, TASK_LABEL, type TaskKey } from "@/speaking/tasks";

/** The default daily target, in minutes, for each speaking task. */
export function SpeakingDefaultsForm({ initial }: { initial: Record<TaskKey, number> }) {
  const [text, setText] = useState<Record<TaskKey, string>>(
    () => Object.fromEntries(TASKS.map((t) => [t, String(initial[t])])) as Record<TaskKey, string>,
  );
  const { run, pending, errors, saved, touch } = useAdminAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const targets = Object.fromEntries(
      TASKS.map((t) => [t, text[t].trim() === "" ? Number.NaN : Number(text[t])]),
    ) as Record<TaskKey, number>;
    run(() => saveDefaultsAction(targets));
  };

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label="Default daily targets">
      <div className="grid gap-4 sm:grid-cols-3">
        {TASKS.map((t) => (
          <Field key={t} label={`${TASK_LABEL[t]} (minutes)`} error={errors[t]}>
            <input
              type="number"
              min={1}
              max={120}
              step={1}
              inputMode="numeric"
              className={inputClass}
              value={text[t]}
              onChange={(e) => {
                touch();
                setText((s) => ({ ...s, [t]: e.target.value }));
              }}
            />
          </Field>
        ))}
      </div>
      <SaveBar label="Save defaults" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
