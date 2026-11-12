"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  confirmPromptImageAction,
  deletePromptAction,
  savePromptAction,
  startPromptImageUploadAction,
} from "@/app/(app)/admin/ielts/tests/actions";
import type { AdminPrompt, PublishStatus } from "@/admin/ieltsTests";
import { Field, TextField } from "@/components/admin/fields";
import { ActionStatus, SaveBar, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { putFile } from "@/lib/uploadFile";
import { UploadError } from "@/lib/uploadTake";

const BACK = "/admin/ielts/writing";

function ImageUpload({ promptId, imageKey, previewUrl }: { promptId: string; imageKey: string; previewUrl?: string }) {
  const { run, pending, errors, setErrors, saved } = useAdminAction();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const upload = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setErrors({});
    try {
      const started = await startPromptImageUploadAction(promptId, file.type, file.size);
      if (!started.ok) {
        setErrors(started.errors);
        return;
      }
      await putFile(started.uploadUrl, file, setProgress);
      run(() => confirmPromptImageAction(promptId, started.key));
    } catch (e) {
      setErrors({ _: e instanceof UploadError ? e.message : "The upload failed. Try again." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field label="Chart or diagram image" group>
      <FileDropzone
        label="Upload the Task 1 image"
        accept="image/*"
        icon="file"
        disabled={pending}
        busy={busy}
        progress={progress}
        hint="PNG, JPEG, WebP or GIF, 5 MB at most."
        files={imageKey ? [{ name: imageKey.split("/").pop() ?? imageKey, size: 0 }] : []}
        onFiles={([file]) => void upload(file)}
      />
      {previewUrl && !busy && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Uploaded Task 1 chart" className="mt-2 max-h-64 rounded border border-border" />
      )}
      <ActionStatus saved={saved && !busy} errors={errors} savedText="Image uploaded." />
    </Field>
  );
}

/** Create or edit a Writing Task 1 or Task 2 prompt. */
export function IeltsPromptForm({ task, prompt, imagePreviewUrl }: { task: "task1" | "task2"; prompt?: AdminPrompt; imagePreviewUrl?: string }) {
  const router = useRouter();
  const [id] = useState(prompt?.id ?? "");
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [brief, setBrief] = useState(prompt?.brief ?? "");
  const [imageAlt, setImageAlt] = useState(prompt?.imageAlt ?? "");
  const [status, setStatus] = useState<PublishStatus>(prompt?.status ?? "draft");
  const { run, pending, errors, saved, touch } = useAdminAction();
  const del = useAdminAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { task, title, brief, imageAlt, status, tags: prompt?.tags ?? [] };
    if (id) run(() => savePromptAction(id, input));
    else run(() => savePromptAction(null, input), { refresh: false, onSuccess: (r) => router.push(`${BACK}/${r.id}`) });
  };

  return (
    <form className="grid gap-5" onSubmit={submit} aria-label={task === "task1" ? "Task 1 prompt" : "Task 2 prompt"}>
      <TextField label="Title" value={title} error={errors.title} onChange={(v) => { touch(); setTitle(v); }} />
      <Field label="Task instruction" error={errors.brief}>
        <textarea className={inputClass} rows={6} value={brief} onChange={(e) => { touch(); setBrief(e.target.value); }} />
      </Field>
      {task === "task1" && (
        <>
          <Field label="Chart described in words (helps the AI, which cannot see the image)" error={errors.imageAlt}>
            <textarea className={inputClass} rows={4} value={imageAlt} onChange={(e) => { touch(); setImageAlt(e.target.value); }} />
          </Field>
          {id ? <ImageUpload promptId={id} imageKey={prompt?.imageKey ?? ""} previewUrl={imagePreviewUrl} /> : <p className="text-sm text-muted-foreground">Save the prompt first, then upload its image.</p>}
        </>
      )}
      <Field label="Status" group error={errors.status}>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          <Chip on={status === "draft"} onClick={() => { touch(); setStatus("draft"); }}>Draft</Chip>
          <Chip on={status === "published"} onClick={() => { touch(); setStatus("published"); }}>Published</Chip>
        </div>
      </Field>
      <SaveBar label={id ? "Save prompt" : "Create prompt"} pending={pending} saved={saved} errors={errors}>
        {id && (
          <Button
            type="button"
            variant="outline"
            disabled={del.pending}
            onClick={() => del.run(() => deletePromptAction(id), { confirm: "Delete this prompt?", refresh: false, onSuccess: () => router.push(BACK) })}
          >
            Delete prompt
          </Button>
        )}
      </SaveBar>
      <ActionStatus saved={false} errors={del.errors} />
    </form>
  );
}
