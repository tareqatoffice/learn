"use client";

import { saveNoteAction } from "@/app/(app)/admin/notes/actions";
import type { AdminNote } from "@/admin/queries";
import { StatusField, SubjectsField, TextField } from "@/components/admin/fields";
import { SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";

export function NoteForm({ note, subjects }: { note: AdminNote; subjects: { slug: string; name: string }[] }) {
  const { draft, set, errors, saved, pending, submit } = useSaveForm(
    note,
    (d) => saveNoteAction(withoutEmptyId(d)),
    (id) => `/admin/notes/${note.seriesId}/chapters/${id}`,
  );
  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Title" value={draft.title} onChange={(v) => set("title", v)} />
        <TextField label="Slug (URL)" value={draft.slug} onChange={(v) => set("slug", v)} />
      </div>
      <StatusField value={draft.status} onChange={(s) => set("status", s)} />
      <SubjectsField options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />
      <MarkdownEditor label="Body" value={draft.body} onChange={(v) => set("body", v)} rows={24} />
      <SaveBar label="Save chapter" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
