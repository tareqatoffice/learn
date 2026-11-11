"use client";

import { FileAudio, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useId, useState } from "react";
import { formatBytes } from "@/lib/uploadFile";

export type DropzoneFile = { name: string; size: number };

/** True when `file` matches an `accept` list (".md", "audio/*", "application/json"); no list accepts all. */
export function matchesAccept(file: { name: string; type: string }, accept?: string): boolean {
  const tokens = (accept ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((t) =>
    t.startsWith(".") ? name.endsWith(t) : t.endsWith("/*") ? type.startsWith(t.slice(0, -1)) : type === t,
  );
}

/**
 * The app's one file picker: a drop target that is also a keyboard-reachable button. It only
 * reports the chosen files; the caller decides what to do with them. `progress` (0..1) shows a bar
 * while `busy`.
 */
export function FileDropzone({
  label,
  hint,
  accept,
  multiple,
  disabled,
  busy,
  progress,
  files = [],
  icon = "file",
  onFiles,
  onClear,
}: {
  /** Accessible name of the file input. */
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  progress?: number;
  /** Files to list under the drop target (already chosen or uploaded). */
  files?: DropzoneFile[];
  icon?: "file" | "audio";
  onFiles: (files: File[]) => void;
  /** Shows a clear button under the chosen-files list. */
  onClear?: () => void;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState(0);
  const off = disabled || busy;
  const Icon = icon === "audio" ? FileAudio : FileText;

  const take = (list: FileList | null) => {
    // Dropped files skip the browser's `accept` filter, so apply it here.
    const all = [...(list ?? [])];
    const picked = all.filter((f) => matchesAccept(f, accept));
    setRejected(all.length - picked.length);
    if (picked.length) onFiles(multiple ? picked : picked.slice(0, 1));
  };

  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          if (off) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!off) take(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-ring/50 ${
          over ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/60"
        } ${off ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <UploadCloud className="size-6 text-muted-foreground" aria-hidden />
        )}
        <span className="text-sm font-medium">
          {busy ? "Uploading…" : over ? "Drop to upload" : multiple ? "Drop files here or " : "Drop a file here or "}
          {!busy && !over && <span className="text-primary underline underline-offset-2">browse</span>}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        <input
          id={id}
          type="file"
          aria-label={label}
          accept={accept}
          multiple={multiple}
          disabled={off}
          className="sr-only"
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {busy && progress !== undefined && (
        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {rejected > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {rejected === 1 ? "That file type isn't accepted." : `${rejected} files weren't accepted (wrong type).`}
        </p>
      )}

      {files.length > 0 && (
        <ul className="grid gap-1.5">
          {files.map((f, i) => (
            <li key={`${i}-${f.name}`} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              {f.size > 0 && <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" aria-hidden /> Clear
        </button>
      )}
    </div>
  );
}
