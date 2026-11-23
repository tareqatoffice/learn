"use client";

import { useState } from "react";
import { resetPromptAction, savePromptAction } from "@/app/(app)/admin/ai/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/features/admin/components/fields";
import { AdminSection } from "@/features/admin/components/layout";
import { ActionStatus, inputClass } from "@/features/admin/components/SaveBar";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { PROMPT_MAX, type PromptKey } from "@/features/ai/lib/prompts";

export type PromptRow = { key: PromptKey; area: string; label: string; help: string; text: string; defaultText: string };

function PromptEditor({ row }: { row: PromptRow }) {
  const [text, setText] = useState(row.text);
  const { run, pending, errors, saved, touch } = useAdminAction();
  const custom = row.text !== row.defaultText;
  const dirty = text.trim() !== row.text;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => savePromptAction(row.key, text));
  };
  const reset = () =>
    run(() => resetPromptAction(row.key), {
      confirm: `Reset "${row.label}" to the default text?`,
      onSuccess: () => setText(row.defaultText),
    });

  return (
    <form onSubmit={save} className="grid gap-2" aria-label={row.label}>
      <Field label={`${row.label}${custom ? " (edited)" : ""}`} error={errors.text}>
        <span className="text-xs text-muted-foreground">{row.help}</span>
        <textarea
          className={`${inputClass} min-h-32 font-mono text-xs`}
          value={text}
          maxLength={PROMPT_MAX}
          onChange={(e) => {
            touch();
            setText(e.target.value);
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending || !custom} onClick={reset}>
          Reset to default
        </Button>
        {dirty && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setText(row.text)}>
            Undo changes
          </Button>
        )}
        <ActionStatus saved={saved} errors={errors.text ? {} : errors} />
      </div>
    </form>
  );
}

export function AiPromptsForm({ rows }: { rows: PromptRow[] }) {
  const areas = [...new Set(rows.map((r) => r.area))];
  return (
    <div className="grid gap-6">
      {areas.map((area) => (
        <AdminSection key={area} title={area}>
          <div className="grid gap-5">
            {rows
              .filter((r) => r.area === area)
              .map((r) => (
                <PromptEditor key={r.key} row={r} />
              ))}
          </div>
        </AdminSection>
      ))}
    </div>
  );
}
