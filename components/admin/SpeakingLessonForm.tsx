"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { MediaPlayer } from "@/components/MediaPlayer";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { audioDuration } from "@/lib/audioDuration";
import { putFile } from "@/lib/uploadFile";
import { UploadError } from "@/lib/uploadTake";

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

function AudioUpload({
  lessonId,
  currentKey,
  previewUrl,
  storageReady,
  onConfirmed,
}: {
  lessonId: string;
  currentKey: string;
  previewUrl?: string;
  storageReady: boolean;
  onConfirmed: (durationSec: number) => void;
}) {
  const { run, pending, errors, setErrors, saved } = useAdminAction();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // A presigned link is new on every page refresh; keep the first one per stored file so a refresh
  // (e.g. after saving) doesn't reload the player and lose its position.
  const audioId = currentKey || previewUrl || "";
  const [shown, setShown] = useState({ id: audioId, url: previewUrl });
  if (shown.id !== audioId) setShown({ id: audioId, url: previewUrl });

  const upload = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setErrors({});
    try {
      const started = await startLessonAudioUploadAction(lessonId, file.type, file.size);
      if (!started.ok) {
        setErrors(started.errors);
        return;
      }
      await putFile(started.uploadUrl, file, setProgress);
      const duration = await audioDuration(file);
      run(() => confirmLessonAudioAction(lessonId, started.key, duration), { onSuccess: () => onConfirmed(duration) });
    } catch (e) {
      setErrors({ _: e instanceof UploadError ? e.message : "The upload failed. Try again." });
    } finally {
      setBusy(false);
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
          <FileDropzone
            label="Upload shadowing audio"
            accept="audio/*"
            icon="audio"
            disabled={pending}
            busy={busy}
            progress={progress}
            hint={`Audio only, ${MAX_AUDIO_MB} MB at most. Replacing a file deletes the old one.`}
            files={currentKey ? [{ name: currentKey.split("/").pop() ?? currentKey, size: 0 }] : []}
            onFiles={([file]) => void upload(file)}
          />
          {shown.url && !busy && <MediaPlayer key={shown.id} src={shown.url} label="uploaded audio" />}
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
  audioPreviewUrl,
}: {
  lesson?: AdminLesson;
  /** A playable link to the uploaded audio (presigned), for the admin to check it. */
  audioPreviewUrl?: string;
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
        previewUrl={audioPreviewUrl}
        storageReady={storageReady}
        onConfirmed={(sec) => setDurationText(String(sec))}
      />
    </div>
  );
}
