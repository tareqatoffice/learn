"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSubjectAction } from "@/app/(app)/admin/subjects/actions";
import { RowActions } from "@/components/admin/RowActions";
import { inputClass } from "@/components/admin/SaveBar";
import { Button } from "@/components/ui/button";

type Row = { id: string; slug: string; name: string };

function SubjectRow({ row, onSave }: { row: Row; onSave: (r: Row) => Promise<string | null> }) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = draft.slug !== row.slug || draft.name !== row.name;
  return (
    <li className="grid items-center gap-2 px-4 py-2 md:grid-cols-[1fr_12.5rem_auto_auto]">
      <input aria-label="Subject name" className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <input aria-label="Subject slug" className={inputClass} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
      <Button
        size="sm"
        variant={row.id ? "outline" : "default"}
        disabled={pending || (!dirty && !!row.id)}
        onClick={() => startTransition(async () => setError(await onSave(draft)))}
      >
        {row.id ? "Rename" : "Add"}
      </Button>
      {row.id ? <RowActions kind="subject" id={row.id} label={row.name} /> : <span />}
      {error && (
        <p role="alert" className="text-sm text-destructive md:col-span-4">
          {error}
        </p>
      )}
    </li>
  );
}

export function SubjectsEditor({ subjects }: { subjects: Row[] }) {
  const router = useRouter();
  const save = async ({ id, ...rest }: Row) => {
    const result = await saveSubjectAction(id ? { id, ...rest } : rest);
    if (!result.ok) return Object.values(result.errors)[0] ?? "Failed";
    router.refresh();
    return null;
  };
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {subjects.map((s) => (
        <SubjectRow key={s.id} row={s} onSave={save} />
      ))}
      <SubjectRow key={`new-${subjects.length}`} row={{ id: "", slug: "", name: "" }} onSave={save} />
    </ul>
  );
}
