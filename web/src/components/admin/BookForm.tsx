"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBookAction } from "@/app/(app)/admin/books/actions";
import type { AdminBook } from "@/admin/queries";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { StatusChips } from "@/components/StatusChips";
import { SubjectPicker } from "@/components/SubjectPicker";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/ids";

const inputClass = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-ring";

const EMPTY: AdminBook = { id: "", slug: "", title: "", intro: "", subjects: [], status: "draft", parts: [], extras: [] };

export function BookForm({ book = EMPTY, subjects }: { book?: AdminBook; subjects: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(book);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof AdminBook>(key: K, value: AdminBook[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  function save() {
    startTransition(async () => {
      const { id, ...rest } = draft;
      const result = await saveBookAction({ ...(id ? { id } : {}), ...rest });
      if (!result.ok) return setErrors(result.errors);
      setErrors({});
      setSaved(true);
      if (!id) router.push(`/admin/books/${result.id}`);
      else router.refresh();
    });
  }

  const updatePart = (i: number, patch: Partial<AdminBook["parts"][number]>) =>
    set("parts", draft.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const updateExtra = (i: number, patch: Partial<AdminBook["extras"][number]>) =>
    set("extras", draft.extras.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            className={inputClass}
            value={draft.title}
            onChange={(e) => {
              const title = e.target.value;
              // New books follow the title until the slug is edited by hand.
              setDraft((d) => ({ ...d, title, slug: d.id || d.slug !== slugify(d.title) ? d.slug : slugify(title) }));
            }}
          />
          {errors.title && <span className="text-destructive">{errors.title}</span>}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Slug (URL)</span>
          <input className={inputClass} value={draft.slug} onChange={(e) => set("slug", e.target.value)} />
          {errors.slug && <span className="text-destructive">{errors.slug}</span>}
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

      <MarkdownEditor label="Intro" value={draft.intro} onChange={(v) => set("intro", v)} rows={5} />

      <fieldset className="grid gap-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Parts</legend>
        {draft.parts.map((p, i) => (
          <div key={i} className="grid gap-2 border-b border-border pb-3 last:border-0">
            <div className="grid gap-2 md:grid-cols-[1fr_200px_auto]">
              <input aria-label={`Part ${i + 1} title`} className={inputClass} value={p.title} onChange={(e) => updatePart(i, { title: e.target.value })} />
              <input aria-label={`Part ${i + 1} key`} className={inputClass} value={p.key} onChange={(e) => updatePart(i, { key: e.target.value })} />
              <Button type="button" variant="outline" size="sm" onClick={() => set("parts", draft.parts.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
            <MarkdownEditor label={`Part ${i + 1} intro`} value={p.intro} onChange={(v) => updatePart(i, { intro: v })} rows={3} />
          </div>
        ))}
        {errors.parts && <p className="text-sm text-destructive">{errors.parts}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => set("parts", [...draft.parts, { key: `part-${draft.parts.length + 1}`, title: "New part", intro: "" }])}
        >
          + Add part
        </Button>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Extras (appendices, plans)</legend>
        {draft.extras.map((x, i) => (
          <div key={i} className="grid gap-2 border-b border-border pb-3 last:border-0">
            <div className="grid gap-2 md:grid-cols-[1fr_200px_auto]">
              <input aria-label={`Extra ${i + 1} title`} className={inputClass} value={x.title} onChange={(e) => updateExtra(i, { title: e.target.value })} />
              <input aria-label={`Extra ${i + 1} key`} className={inputClass} value={x.key} onChange={(e) => updateExtra(i, { key: e.target.value })} />
              <Button type="button" variant="outline" size="sm" onClick={() => set("extras", draft.extras.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
            <MarkdownEditor label={`Extra ${i + 1} body`} value={x.body} onChange={(v) => updateExtra(i, { body: v })} rows={5} />
          </div>
        ))}
        {errors.extras && <p className="text-sm text-destructive">{errors.extras}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => set("extras", [...draft.extras, { key: `extra-${draft.extras.length + 1}`, title: "New section", body: "" }])}
        >
          + Add extra
        </Button>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save book"}
        </Button>
        {saved && (
          <span role="status" className="text-sm text-muted-foreground">
            Saved.
          </span>
        )}
        {Object.keys(errors).length > 0 && (
          <span role="alert" className="text-sm text-destructive">
            {Object.values(errors)[0]}
          </span>
        )}
      </div>
    </form>
  );
}
