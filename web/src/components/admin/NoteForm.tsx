"use client";

import { saveNoteAction } from "@/app/(app)/admin/notes/actions";
import type { AdminNote } from "@/admin/queries";
import { inputClass, SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { StatusChips } from "@/components/StatusChips";
import { SubjectPicker } from "@/components/SubjectPicker";

export function NoteForm({ note, subjects }: { note: AdminNote; subjects: { slug: string; name: string }[] }) {
  const { draft, set, errors, saved, pending, submit } = useSaveForm(
    note,
    (d) => saveNoteAction(withoutEmptyId(d)),
    (id) => `/admin/notes/${note.seriesId}/chapters/${id}`,
  );
  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input className={inputClass} value={draft.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Slug (URL)</span>
          <input className={inputClass} value={draft.slug} onChange={(e) => set("slug", e.target.value)} />
        </label>
      </div>
      <div className="grid gap-1">
        <span className="text-sm font-medium">Status</span>
        <StatusChips value={draft.status} onChange={(s) => set("status", s)} />
      </div>
      <div className="grid gap-1">
        <span className="text-sm font-medium">Subjects</span>
        <SubjectPicker options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />
      </div>
      <MarkdownEditor label="Body" value={draft.body} onChange={(v) => set("body", v)} rows={24} />
      <SaveBar label="Save chapter" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
