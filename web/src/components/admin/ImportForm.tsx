"use client";

import { useState, useTransition } from "react";
import { commitImportAction, previewImportAction, type ImportInput } from "@/app/(app)/admin/import/actions";
import { inputClass } from "@/components/admin/SaveBar";
import { Button } from "@/components/ui/button";
import type { ImportReport } from "@/content/types";

type Kind = "book" | "series" | "graph";
type Files = { name: string; content: string }[];

/** Paste or upload content, preview the import, then commit exactly what was previewed. */
export function ImportForm() {
  const [kind, setKind] = useState<Kind>("book");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [publish, setPublish] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Files>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [previewed, setPreviewed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function build(): ImportInput | string {
    const target = { kind, slug: slug.trim() };
    const base = { target, title: title.trim() || undefined, publish };
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

  const current = build();
  const key = typeof current === "string" ? null : JSON.stringify(current);
  const canCommit = !!report && !report.errors.length && previewed !== null && previewed === key;

  const go = (commit: boolean) =>
    startTransition(async () => {
      setError(null);
      if (typeof current === "string") return setError(current);
      const r = await (commit ? commitImportAction(current) : previewImportAction(current));
      if ("error" in r) return setError(r.error);
      setReport(r);
      setPreviewed(commit ? null : key);
    });

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Target kind</span>
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="book">Question book (markdown)</option>
            <option value="series">Note series (one .md per chapter)</option>
            <option value="graph">Graph (JSON)</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Target slug</span>
          <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="existing or new slug" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Title (only to create a new target)</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Files</span>
        <input
          type="file"
          multiple={kind === "series"}
          accept={kind === "graph" ? ".json,application/json" : ".md,text/markdown"}
          onChange={async (e) => setFiles(await Promise.all([...(e.target.files ?? [])].map(async (f) => ({ name: f.name, content: await f.text() }))))}
        />
        {files.length > 0 && <span className="text-muted-foreground">{files.map((f) => f.name).join(", ")}</span>}
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">…or paste</span>
        <textarea className={`${inputClass} font-mono`} rows={12} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
        Publish new items (otherwise they start as drafts)
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={pending} onClick={() => go(false)}>
          Preview
        </Button>
        <Button disabled={pending || !canCommit} onClick={() => go(true)}>
          Commit
        </Button>
        {!canCommit && report && !report.dryRun && <span className="text-sm text-muted-foreground">Committed. Preview again to make more changes.</span>}
        {error && (
          <span role="alert" className="text-sm text-destructive">
            {error}
          </span>
        )}
      </div>

      {report && (
        <section aria-label="Import report" className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">
            {report.dryRun ? "Preview — nothing written yet" : "Committed"}
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
