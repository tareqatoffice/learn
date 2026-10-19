"use client";

import { saveNodeAction } from "@/app/(app)/admin/graphs/actions";
import type { AdminNode, AdminRelated } from "@/admin/queries";
import { inputClass, SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { PrereqPicker } from "@/components/PrereqPicker";
import { RelatedPicker } from "@/components/RelatedPicker";
import { StatusChips } from "@/components/StatusChips";
import { SubjectPicker } from "@/components/SubjectPicker";

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
  const fieldError = (key: string) => errors[key] && <span className="text-sm text-destructive">{errors[key]}</span>;

  return (
    <div className="grid gap-6">
      <form className="grid gap-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Title (max 22 chars)</span>
            <input className={inputClass} value={draft.title} maxLength={40} onChange={(e) => set("title", e.target.value)} />
            {fieldError("title")}
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Slug</span>
            <input className={inputClass} value={draft.slug} onChange={(e) => set("slug", e.target.value)} />
            {fieldError("slug")}
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Track</span>
            <select className={inputClass} value={draft.trackKey} onChange={(e) => set("trackKey", e.target.value)}>
              {tracks.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
            {fieldError("trackKey")}
          </label>
        </div>
        <div className="grid gap-1">
          <span className="text-sm font-medium">Status</span>
          <StatusChips value={draft.status} onChange={(s) => set("status", s)} />
        </div>
        <div className="grid gap-1">
          <span className="text-sm font-medium">Needed first</span>
          <PrereqPicker options={siblings} selfId={draft.id || undefined} value={draft.prereqIds} onChange={(v) => set("prereqIds", v)} />
          {fieldError("prereqIds")}
        </div>
        <MarkdownEditor label="Summary" value={draft.summary} onChange={(v) => set("summary", v)} rows={3} error={errors.summary} />
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Key points (one per line, inline markdown)</span>
          <textarea className={`${inputClass} font-mono`} rows={5} value={draft.points.join("\n")} onChange={(e) => set("points", e.target.value.split("\n"))} />
          {fieldError("points")}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Code</span>
          <textarea className={`${inputClass} font-mono`} rows={6} value={draft.code} onChange={(e) => set("code", e.target.value)} />
          {fieldError("code")}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Common mistake</span>
          <input className={inputClass} value={draft.pitfall} onChange={(e) => set("pitfall", e.target.value)} />
          {fieldError("pitfall")}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Docs URL (https)</span>
          <input className={inputClass} value={draft.docsUrl} onChange={(e) => set("docsUrl", e.target.value)} />
          {fieldError("docsUrl")}
        </label>
        <div className="grid gap-1">
          <span className="text-sm font-medium">Subjects</span>
          <SubjectPicker options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />
        </div>
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
