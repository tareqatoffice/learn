"use client";

import { useId } from "react";
import { Markdown } from "@/lib/markdown/Markdown";

/** Markdown textarea with a live preview through the same renderer readers see. */
export function MarkdownEditor({
  label,
  value,
  onChange,
  rows = 8,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <textarea
          id={id}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="min-h-24 w-full rounded-md border border-input bg-background p-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
        <div aria-label={`${label} preview`} className="min-h-24 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-sm">
          {value.trim() ? <Markdown source={value} /> : <p className="text-muted-foreground">Preview</p>}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
