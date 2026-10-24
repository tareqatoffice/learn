"use client";

import { saveSeriesAction } from "@/app/(app)/admin/notes/actions";
import type { AdminSeries } from "@/admin/queries";
import { StatusField, SubjectsField, TextField } from "@/components/admin/fields";
import { SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";

const EMPTY: AdminSeries = { id: "", slug: "", title: "", description: "", subjects: [], status: "draft" };

export function SeriesForm({ series = EMPTY, subjects }: { series?: AdminSeries; subjects: { slug: string; name: string }[] }) {
  const { draft, set, errors, saved, pending, submit } = useSaveForm(series, (d) => saveSeriesAction(withoutEmptyId(d)), (id) => `/admin/notes/${id}`);
  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Title" value={draft.title} onChange={(v) => set("title", v)} />
        <TextField label="Slug (URL)" value={draft.slug} onChange={(v) => set("slug", v)} />
      </div>
      <StatusField value={draft.status} onChange={(s) => set("status", s)} />
      <SubjectsField options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />
      <MarkdownEditor label="Description (shown on the series page)" value={draft.description} onChange={(v) => set("description", v)} rows={8} />
      <SaveBar label="Save series" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
