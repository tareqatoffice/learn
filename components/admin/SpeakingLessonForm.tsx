"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  confirmLessonAudioAction,
  createLessonAction,
  deleteLessonAction,
  startLessonAudioUploadAction,
  updateLessonAction,
} from "@/app/(app)/admin/speaking/actions";
import type { AdminLesson } from "@/admin/speaking";
import { Field, StatusField, SubjectsField, TextField } from "@/components/admin/fields";
import { ActionStatus, SaveBar, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

const EMPTY: AdminLesson = {
  id: "",
  title: "",
  order: 0,
  status: "draft",
  subjectIds: [],
  shadowText: "",
  shadowAudioUrl: "",
  shadowAudioKey: "",
  shadowDurationSec: 0,
  passage: "",
  prompt: "",
};

const MAX_AUDIO_MB = 50;

/** Reads an audio file's length in seconds in the browser; 0 when it can't be decoded. */
function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = new Audio();
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(n) ? Math.round(n) : 0);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    el.src = url;
  });
}

function AudioUpload({
  lessonId,
  currentKey,
  storageReady,
  onConfirmed,
}: {
  lessonId: string;
  currentKey: string;
  storageReady: boolean;
  onConfirmed: (durationSec: number) => void;
}) {
  const { run, pending, errors, setErrors, saved } = useAdminAction();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErrors({});
    try {
      const started = await startLessonAudioUploadAction(lessonId, file.type, file.size);
      if (!started.ok) {
        setErrors(started.errors);
        return;
      }
      const put = await fetch(started.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) {
        setErrors({ _: "The upload failed. Check the bucket's CORS settings and try again." });
        return;
      }
      const duration = await audioDuration(file);
      run(() => confirmLessonAudioAction(lessonId, started.key, duration), { onSuccess: () => onConfirmed(duration) });
    } catch {
      setErrors({ _: "The upload failed. Try again." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Field label="Shadowing audio file" group>
      {!storageReady ? (
        <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          File storage isn&apos;t configured (set the R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET environment
          variables), so audio can&apos;t be uploaded. You can link to an https audio URL below instead.
        </p>
      ) : !lessonId ? (
        <p className="text-sm text-muted-foreground">Save the lesson first, then upload its audio here.</p>
      ) : (
        <div className="grid gap-2">
          {currentKey && <span className="text-xs text-muted-foreground">Uploaded: <code>{currentKey}</code></span>}
          <input
            ref={input}
            type="file"
            accept="audio/*"
            aria-label="Upload shadowing audio"
            disabled={busy || pending}
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <span className="text-xs text-muted-foreground">Audio only, {MAX_AUDIO_MB} MB at most. Replacing a file deletes the old one.</span>
          {busy && <span role="status" className="text-sm text-muted-foreground">Uploading…</span>}
          <ActionStatus saved={saved && !busy} errors={errors} savedText="Audio uploaded." />
        </div>
      )}
    </Field>
  );
}

export function SpeakingLessonForm({
  lesson = EMPTY,
  subjects,
  storageReady,
}: {
  lesson?: AdminLesson;
  /** `slug` carries the subject's id. */
  subjects: { slug: string; name: string }[];
  storageReady: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(lesson);
  const [durationText, setDurationText] = useState(String(lesson.shadowDurationSec));
  const { run, pending, errors, saved, touch } = useAdminAction();
  const del = useAdminAction();

  // Re-seed after the server page refreshes with new data (e.g. an uploaded file's length).
  const [seenDuration, setSeenDuration] = useState(lesson.shadowDurationSec);
  if (seenDuration !== lesson.shadowDurationSec) {
    setSeenDuration(lesson.shadowDurationSec);
    setDurationText(String(lesson.shadowDurationSec));
  }

  const set = <K extends keyof AdminLesson>(key: K, value: AdminLesson[K]) => {
    touch();
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, title, status, subjectIds, shadowText, shadowAudioUrl, passage, prompt } = draft;
    const shadowDurationSec = durationText.trim() === "" ? 0 : Number(durationText);
    const input = { title, status, subjectIds, shadowText, shadowAudioUrl, shadowDurationSec, passage, prompt };
    if (id) run(() => updateLessonAction(id, input));
    else run(() => createLessonAction(input), { refresh: false, onSuccess: (r) => router.push(`/admin/speaking/${r.id}`) });
  };

  return (
    <div className="grid gap-5">
      <form className="grid gap-5" onSubmit={submit} aria-label="Speaking lesson">
        <TextField label="Title" value={draft.title} error={errors.title} onChange={(v) => set("title", v)} />
        <StatusField value={draft.status} onChange={(s) => set("status", s)} />
        <SubjectsField options={subjects} value={draft.subjectIds} onChange={(v) => set("subjectIds", v)} />

        <Field label="Shadowing text (the transcript learners follow)" error={errors.shadowText}>
          <textarea className={inputClass} rows={5} value={draft.shadowText} onChange={(e) => set("shadowText", e.target.value)} />
        </Field>
        <TextField
          label="Shadowing audio link (https, optional)"
          type="url"
          placeholder="https://"
          value={draft.shadowAudioUrl}
          error={errors.shadowAudioUrl}
          onChange={(v) => set("shadowAudioUrl", v)}
        />
        <Field label="Shadowing audio length (seconds)" error={errors.shadowDurationSec}>
          <input
            type="number"
            min={0}
            max={1200}
            step={1}
            inputMode="numeric"
            className={`${inputClass} max-w-40`}
            value={durationText}
            onChange={(e) => {
              touch();
              setDurationText(e.target.value);
            }}
          />
        </Field>

        <Field label="Read-aloud passage" error={errors.passage}>
          <textarea className={inputClass} rows={6} value={draft.passage} onChange={(e) => set("passage", e.target.value)} />
        </Field>
        <Field label="Speaking prompt (record and review)" error={errors.prompt}>
          <textarea className={inputClass} rows={3} value={draft.prompt} onChange={(e) => set("prompt", e.target.value)} />
        </Field>

        <SaveBar label={draft.id ? "Save lesson" : "Create lesson"} pending={pending} saved={saved} errors={errors}>
          {draft.id && (
            <Button
              type="button"
              variant="outline"
              disabled={del.pending}
              onClick={() =>
                del.run(() => deleteLessonAction(draft.id), {
                  confirm: "Delete this lesson? Learners' recordings are kept.",
                  refresh: false,
                  onSuccess: () => router.push("/admin/speaking"),
                })
              }
            >
              Delete lesson
            </Button>
          )}
        </SaveBar>
        <ActionStatus saved={false} errors={del.errors} />
      </form>

      <AudioUpload
        lessonId={draft.id}
        currentKey={lesson.shadowAudioKey}
        storageReady={storageReady}
        onConfirmed={(sec) => setDurationText(String(sec))}
      />
    </div>
  );
}
