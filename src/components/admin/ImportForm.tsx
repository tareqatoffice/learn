"use client";

import { useState, useTransition } from "react";
import { commitImportAction, previewImportAction, type ImportInput } from "@/app/(app)/admin/import/actions";
import { inputClass } from "@/components/admin/SaveBar";
import { SubjectPicker } from "@/components/SubjectPicker";
import { Button } from "@/components/ui/button";
import type { ImportReport } from "@/content/types";

type Kind = "book" | "series" | "graph";
type Files = { name: string; content: string }[];

/** Paste or upload content, preview the import, then commit exactly what was previewed. */
export function ImportForm({ subjectOptions }: { subjectOptions: { slug: string; name: string }[] }) {
  const [kind, setKind] = useState<Kind>("book");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [publish, setPublish] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Files>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  // True only while the inputs are exactly what the last clean preview saw; any edit clears it.
  const [previewClean, setPreviewClean] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Wraps a setter so every input change invalidates the last preview. */
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setPreviewClean(false);
      setter(value);
    };

  // Built only when Preview or Commit is pressed, never per keystroke.
  function build(): ImportInput | string {
    const target = { kind, slug: slug.trim() };
    const base = { target, title: title.trim() || undefined, subjects, publish };
    if (kind === "series") {
      const list = files.length ? files : text.trim() ? [{ name: "pasted.md", content: text }] : [];
      return list.length ? { ...base, source: { kind, files: list } } : "Add chapter files or paste one chapter";
    }
    const body = files.length ? files.map((f) => f.content).join("\n\n") : text;
    if (!body.trim()) return "Paste content or choose a file";
    if (kind === "graph") {
      try {
        return { ...base, source: { kind, json: JSON.parse(body) } };
      } catch {
        return "Graph content must be JSON";
      }
    }
    return { ...base, source: { kind, markdown: body } };
  }

  // A commit that reports errors wrote nothing (the plan stopped it, or the transaction rolled back).
  const committed = report !== null && !report.dryRun && report.errors.length === 0;

  const go = (commit: boolean) =>
    startTransition(async () => {
      setError(null);
      const input = build();
      if (typeof input === "string") return setError(input);
      const r = await (commit ? commitImportAction(input) : previewImportAction(input));
      if ("error" in r) return setError(r.error);
      setReport(r);
      setPreviewClean(!commit && !r.errors.length);
    });

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Target kind</span>
          <select className={inputClass} value={kind} onChange={(e) => edit(setKind)(e.target.value as Kind)}>
            <option value="book">Question book (markdown)</option>
            <option value="series">Note series (one .md per chapter)</option>
            <option value="graph">Graph (JSON)</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Target slug</span>
          <input className={inputClass} value={slug} onChange={(e) => edit(setSlug)(e.target.value)} placeholder="existing or new slug" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Title (only to create a new target)</span>
          <input className={inputClass} value={title} onChange={(e) => edit(setTitle)(e.target.value)} />
        </label>
      </div>

      <div className="grid gap-1 text-sm">
        <span className="font-medium">Subjects (only to create a new target; its new items inherit them)</span>
        <SubjectPicker options={subjectOptions} value={subjects} onChange={edit(setSubjects)} />
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Files</span>
        <input
          type="file"
          multiple={kind === "series"}
          accept={kind === "graph" ? ".json,application/json" : ".md,text/markdown"}
          onChange={async (e) =>
            edit(setFiles)(await Promise.all([...(e.target.files ?? [])].map(async (f) => ({ name: f.name, content: await f.text() }))))
          }
        />
        {files.length > 0 && <span className="text-muted-foreground">{files.map((f) => f.name).join(", ")}</span>}
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">…or paste</span>
        <textarea className={`${inputClass} font-mono`} rows={12} value={text} onChange={(e) => edit(setText)(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={publish} onChange={(e) => edit(setPublish)(e.target.checked)} />
        Publish new items (otherwise they start as drafts)
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={pending} onClick={() => go(false)}>
          Preview
        </Button>
        <Button disabled={pending || !previewClean} onClick={() => go(true)}>
          Commit
        </Button>
        {committed && <span className="text-sm text-muted-foreground">Committed. Preview again to make more changes.</span>}
        {error && (
          <span role="alert" className="text-sm text-destructive">
            {error}
          </span>
        )}
      </div>

      {report && (
        <section aria-label="Import report" className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">
            {report.dryRun ? "Preview — nothing written yet" : committed ? "Committed" : "Not committed — nothing was written"}
            {report.createdTarget ? " · creates the target" : ""}
          </p>
          <p>
            {report.creates} new · {report.updates} changed · {report.unchanged} unchanged
          </p>
          {report.errors.map((e) => (
            <p key={e} role="alert" className="text-destructive">
              {e}
            </p>
          ))}
          {report.warnings.map((w) => (
            <p key={w} className="text-muted-foreground">
              warning: {w}
            </p>
          ))}
          <ul className="grid gap-1">
            {report.items
              .filter((i) => i.action !== "unchanged")
              .map((i, n) => (
                <li key={`${i.type}-${i.key}-${n}`} className="font-mono text-xs">
                  {i.action} {i.type} {i.key}
                  {i.fields?.length ? ` [${i.fields.join(", ")}]` : ""}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
