"use client";

import { saveBookAction } from "@/app/(app)/admin/books/actions";
import type { AdminBook } from "@/admin/queries";
import { StatusField, SubjectsField, TextField } from "@/components/admin/fields";
import { inputClass, SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/ids";

const EMPTY: AdminBook = { id: "", slug: "", title: "", intro: "", subjects: [], status: "draft", parts: [], extras: [] };

export function BookForm({ book = EMPTY, subjects }: { book?: AdminBook; subjects: { slug: string; name: string }[] }) {
  const { draft, setDraft, set, errors, saved, pending, submit } = useSaveForm(
    book,
    (d) => saveBookAction(withoutEmptyId(d)),
    (id) => `/admin/books/${id}`,
  );

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Title"
          value={draft.title}
          // New books follow the title until the slug is edited by hand.
          onChange={(title) => setDraft((d) => ({ ...d, title, slug: d.id || d.slug !== slugify(d.title) ? d.slug : slugify(title) }))}
          error={errors.title}
        />
        <TextField label="Slug (URL)" value={draft.slug} onChange={(v) => set("slug", v)} error={errors.slug} />
      </div>

      <StatusField value={draft.status} onChange={(s) => set("status", s)} />
      <SubjectsField options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />

      <MarkdownEditor label="Intro" value={draft.intro} onChange={(v) => set("intro", v)} rows={5} />

      <SectionsEditor
        legend="Parts"
        noun="Part"
        textField="intro"
        rows={3}
        items={draft.parts}
        onChange={(parts) => set("parts", parts)}
        create={(n) => ({ key: `part-${n}`, title: "New part", intro: "" })}
        addLabel="+ Add part"
        error={errors.parts}
      />

      <SectionsEditor
        legend="Extras (appendices, plans)"
        noun="Extra"
        textField="body"
        rows={5}
        items={draft.extras}
        onChange={(extras) => set("extras", extras)}
        create={(n) => ({ key: `extra-${n}`, title: "New section", body: "" })}
        addLabel="+ Add extra"
        error={errors.extras}
      />

      <SaveBar label="Save book" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}

type Section = { key: string; title: string };

/** Editable list of keyed, titled sections with one markdown field each (book parts and extras). */
function SectionsEditor<T extends Section, F extends Exclude<keyof T, keyof Section>>({
  legend,
  noun,
  textField,
  rows,
  items,
  onChange,
  create,
  addLabel,
  error,
}: {
  legend: string;
  noun: string;
  textField: F;
  rows: number;
  items: T[];
  onChange: (items: T[]) => void;
  create: (n: number) => T;
  addLabel: string;
  error?: string;
}) {
  const update = (i: number, patch: Partial<T>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      {items.map((x, i) => (
        <div key={i} className="grid gap-2 border-b border-border pb-3 last:border-0">
          <div className="grid gap-2 md:grid-cols-[1fr_200px_auto]">
            <input
              aria-label={`${noun} ${i + 1} title`}
              className={inputClass}
              value={x.title}
              onChange={(e) => update(i, { title: e.target.value } as Partial<T>)}
            />
            <input
              aria-label={`${noun} ${i + 1} key`}
              className={inputClass}
              value={x.key}
              onChange={(e) => update(i, { key: e.target.value } as Partial<T>)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
          <MarkdownEditor
            label={`${noun} ${i + 1} ${String(textField)}`}
            value={String(x[textField])}
            onChange={(v) => update(i, { [textField]: v } as Partial<T>)}
            rows={rows}
          />
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...items, create(items.length + 1)])}>
        {addLabel}
      </Button>
    </fieldset>
  );
}
