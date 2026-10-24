"use client";

import { saveGraphAction } from "@/app/(app)/admin/graphs/actions";
import type { AdminGraph } from "@/admin/queries";
import { StatusField, SubjectsField, TextField } from "@/components/admin/fields";
import { inputClass, SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";
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
        <TextField label="Title" value={draft.title} onChange={(v) => set("title", v)} />
        <TextField label="Slug (URL)" value={draft.slug} onChange={(v) => set("slug", v)} />
      </div>
      <TextField label="Subtitle" value={draft.subtitle} onChange={(v) => set("subtitle", v)} />
      <StatusField value={draft.status} onChange={(s) => set("status", s)} />
      <SubjectsField options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />
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
