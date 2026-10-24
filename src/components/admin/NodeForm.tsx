"use client";

import { saveNodeAction } from "@/app/(app)/admin/graphs/actions";
import type { AdminNode, AdminRelated } from "@/admin/queries";
import { Field, StatusField, SubjectsField, TextField } from "@/components/admin/fields";
import { inputClass, SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { PrereqPicker } from "@/components/PrereqPicker";
import { RelatedPicker } from "@/components/RelatedPicker";

export function NodeForm({
  node,
  tracks,
  siblings,
  subjects,
  graphSubjects,
  related,
}: {
  node: AdminNode;
  tracks: { key: string; name: string }[];
  siblings: { id: string; title: string }[];
  subjects: { slug: string; name: string }[];
  graphSubjects: string[];
  related?: AdminRelated;
}) {
  const { draft, set, errors, saved, pending, submit } = useSaveForm(
    node,
    (d) => saveNodeAction(withoutEmptyId(d)),
    (id) => `/admin/graphs/${node.graphId}/topics/${id}`,
  );
  return (
    <div className="grid gap-6">
      <form className="grid gap-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField label="Title (max 22 chars)" value={draft.title} maxLength={40} onChange={(v) => set("title", v)} error={errors.title} />
          <TextField label="Slug" value={draft.slug} onChange={(v) => set("slug", v)} error={errors.slug} />
          <Field label="Track" error={errors.trackKey}>
            <select className={inputClass} value={draft.trackKey} onChange={(e) => set("trackKey", e.target.value)}>
              {tracks.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <StatusField value={draft.status} onChange={(s) => set("status", s)} />
        <Field label="Needed first" error={errors.prereqIds} group>
          <PrereqPicker options={siblings} selfId={draft.id || undefined} value={draft.prereqIds} onChange={(v) => set("prereqIds", v)} />
        </Field>
        <MarkdownEditor label="Summary" value={draft.summary} onChange={(v) => set("summary", v)} rows={3} error={errors.summary} />
        <Field label="Key points (one per line, inline markdown)" error={errors.points}>
          <textarea className={`${inputClass} font-mono`} rows={5} value={draft.points.join("\n")} onChange={(e) => set("points", e.target.value.split("\n"))} />
        </Field>
        <Field label="Code" error={errors.code}>
          <textarea className={`${inputClass} font-mono`} rows={6} value={draft.code} onChange={(e) => set("code", e.target.value)} />
        </Field>
        <TextField label="Common mistake" value={draft.pitfall} onChange={(v) => set("pitfall", v)} error={errors.pitfall} />
        <TextField label="Docs URL (https)" value={draft.docsUrl} onChange={(v) => set("docsUrl", v)} error={errors.docsUrl} />
        <SubjectsField options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />
        <SaveBar label="Save topic" pending={pending} saved={saved} errors={errors} />
      </form>

      {draft.id && related ? (
        <RelatedPicker nodeId={draft.id} subjects={draft.subjects.length ? draft.subjects : graphSubjects} initial={related} />
      ) : (
        <p className="text-sm text-muted-foreground">Save the topic to link questions and notes.</p>
      )}
    </div>
  );
}
