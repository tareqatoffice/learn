"use client";

import { useState } from "react";
import { deleteSubjectAction, saveSubjectAction } from "@/app/(app)/admin/subjects/actions";
import { AdminList } from "@/components/admin/layout";
import { RowActions } from "@/components/admin/RowActions";
import { ActionStatus, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

type Row = { id: string; slug: string; name: string };

function SubjectRow({ row }: { row: Row }) {
  const [draft, setDraft] = useState(row);
  const { run, pending, errors, touch } = useAdminAction();
  const del = useAdminAction();
  const dirty = draft.slug !== row.slug || draft.name !== row.name;
  const edit = (next: Row) => {
    touch();
    setDraft(next);
  };
  const save = () => {
    const { id, ...rest } = draft;
    run(() => saveSubjectAction(id ? { id, ...rest } : rest));
  };
  return (
    <li className="grid items-center gap-2 px-4 py-2 md:grid-cols-[1fr_12.5rem_auto_auto_auto]">
      <input aria-label="Subject name" className={inputClass} value={draft.name} onChange={(e) => edit({ ...draft, name: e.target.value })} />
      <input aria-label="Subject slug" className={inputClass} value={draft.slug} onChange={(e) => edit({ ...draft, slug: e.target.value })} />
      <Button size="sm" variant={row.id ? "outline" : "default"} disabled={pending || (!dirty && !!row.id)} onClick={save}>
        {row.id ? "Rename" : "Add"}
      </Button>
      {row.id ? <RowActions kind="subject" id={row.id} label={row.name} /> : <span />}
      {row.id ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={del.pending}
          aria-label={`Delete subject ${row.name}`}
          onClick={() => del.run(() => deleteSubjectAction(row.id), { confirm: `Delete the subject "${row.name}"?` })}
        >
          Delete
        </Button>
      ) : (
        <span />
      )}
      {Object.keys({ ...errors, ...del.errors }).length > 0 && (
        <span className="md:col-span-5">
          <ActionStatus saved={false} errors={{ ...errors, ...del.errors }} />
        </span>
      )}
    </li>
  );
}

export function SubjectsEditor({ subjects }: { subjects: Row[] }) {
  return (
    <AdminList label="Subjects">
      {subjects.map((s) => (
        <SubjectRow key={s.id} row={s} />
      ))}
      {/* The last row adds a subject; its key changes after an add, so it starts empty again. */}
      <SubjectRow key={`new-${subjects.length}`} row={{ id: "", slug: "", name: "" }} />
    </AdminList>
  );
}
