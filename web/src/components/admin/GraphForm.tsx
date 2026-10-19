"use client";

import { saveGraphAction } from "@/app/(app)/admin/graphs/actions";
import type { AdminGraph } from "@/admin/queries";
import { inputClass, SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { StatusChips } from "@/components/StatusChips";
import { SubjectPicker } from "@/components/SubjectPicker";
import { Button } from "@/components/ui/button";

const EMPTY: AdminGraph = {
  id: "",
  slug: "",
  title: "",
  subtitle: "",
  footer: "",
  subjects: [],
  status: "draft",
  tracks: [
    { key: "basics", name: "Basics" },
    { key: "advanced", name: "Advanced" },
  ],
};

export function GraphForm({ graph = EMPTY, subjects }: { graph?: AdminGraph; subjects: { slug: string; name: string }[] }) {
  const { draft, set, errors, saved, pending, submit } = useSaveForm(graph, (d) => saveGraphAction(withoutEmptyId(d)), (id) => `/admin/graphs/${id}`);
  const updateTrack = (i: number, patch: Partial<AdminGraph["tracks"][number]>) =>
    set("tracks", draft.tracks.map((t, j) => (j === i ? { ...t, ...patch } : t)));

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
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Subtitle</span>
        <input className={inputClass} value={draft.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
      </label>
      <div className="grid gap-1">
        <span className="text-sm font-medium">Status</span>
        <StatusChips value={draft.status} onChange={(s) => set("status", s)} />
      </div>
      <div className="grid gap-1">
        <span className="text-sm font-medium">Subjects</span>
        <SubjectPicker options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />
      </div>
      <fieldset className="grid gap-2 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Tracks (2 to 6)</legend>
        {draft.tracks.map((t, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[1fr_200px_auto]">
            <input aria-label={`Track ${i + 1} name`} className={inputClass} value={t.name} onChange={(e) => updateTrack(i, { name: e.target.value })} />
            <input aria-label={`Track ${i + 1} key`} className={inputClass} value={t.key} onChange={(e) => updateTrack(i, { key: e.target.value })} />
            <Button type="button" size="sm" variant="outline" onClick={() => set("tracks", draft.tracks.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        {draft.tracks.length < 6 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-self-start"
            onClick={() => set("tracks", [...draft.tracks, { key: `track-${draft.tracks.length + 1}`, name: "New track" }])}
          >
            + Add track
          </Button>
        )}
      </fieldset>
      <MarkdownEditor label="Footer" value={draft.footer} onChange={(v) => set("footer", v)} rows={3} />
      <SaveBar label="Save graph" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
