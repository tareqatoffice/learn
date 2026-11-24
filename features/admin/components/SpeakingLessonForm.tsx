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
import type { AdminLesson } from "@/features/admin/speaking";
import { Field, StatusField, SubjectsField, TextField } from "@/features/admin/components/fields";
import { ActionStatus, SaveBar, inputClass } from "@/features/admin/components/SaveBar";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { Button } from "@/components/ui/button";
import { MediaPlayer } from "@/components/MediaPlayer";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { audioDuration } from "@/features/admin/lib/audioDuration";
import { putFile, UploadError } from "@/lib/uploadFile";
import { splitSentences } from "@/features/speaking/shadowText";
import { clock } from "@/lib/format";

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
  shadowMarks: [],
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

export function SentenceTimer({
  text,
  src,
  marks,
  onChange,
  cleared = false,
  error,
}: {
  text: string;
  src?: string;
  marks: number[];
  onChange: (marks: number[]) => void;
  cleared?: boolean;
  error?: string;
}) {
  const audio = useRef<HTMLVideoElement | null>(null);
  const sentences = splitSentences(text);
  const stale = marks.length > sentences.length;
  const done = !stale && marks.length === sentences.length && sentences.length > 0;

  if (!sentences.length) return null;

  const begin = () => {
    const el = audio.current;
    if (!el) return;
    onChange([]);
    el.currentTime = 0;
    void el.play()?.catch(() => {});
  };
  const mark = () => {
    const el = audio.current;
    if (!el || marks.length >= sentences.length) return;
    const t = Math.round(el.currentTime * 10) / 10;
    if (marks.length && t <= marks[marks.length - 1]) return;
    const next = [...marks, t];
    onChange(next);
    if (next.length === sentences.length) el.pause();
  };

  return (
    <Field label="Sentence timing" group error={error}>
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">
          Learners see each sentence light up as the clip plays, and the repeat button loops one sentence. Every sentence must be
          timed before the lesson can be published. Press Start, then press Mark each time a new sentence begins (the first one
          too). Save the lesson after.
        </p>
        {!src ? (
          <p className="text-sm text-muted-foreground">Add the audio first.</p>
        ) : (
          <>
            <MediaPlayer
              key={src}
              src={src}
              label="lesson audio"
              playerRef={(node) => {
                audio.current = node;
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={begin}>
                Start
              </Button>
              <Button type="button" size="sm" onClick={mark} disabled={marks.length >= sentences.length}>
                Mark sentence {Math.min(marks.length + 1, sentences.length)}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} disabled={!marks.length}>
                Clear timings
              </Button>
              <span role="status" className="text-sm text-muted-foreground">
                {stale
                  ? "The text changed, so these timings no longer fit. Clear them and mark again."
                  : cleared && !marks.length
                    ? "The text or audio changed, so the timings were cleared. Mark again, or leave them for the app to guess."
                    : done
                    ? `All ${sentences.length} sentences timed.`
                    : `${marks.length} of ${sentences.length} sentences timed.`}
              </span>
            </div>
          </>
        )}
        <ol className="grid gap-1 text-sm">
          {sentences.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-12 shrink-0 font-mono tabular-nums text-muted-foreground">
                {marks[i] !== undefined && !stale ? clock(marks[i]) : "—"}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
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
  audioPreviewUrl?: string;
  subjects: { slug: string; name: string }[];
  storageReady: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(lesson);
  const [durationText, setDurationText] = useState(String(lesson.shadowDurationSec));
  const { run, pending, errors, saved, touch } = useAdminAction();
  const del = useAdminAction();

  const [seenDuration, setSeenDuration] = useState(lesson.shadowDurationSec);
  if (seenDuration !== lesson.shadowDurationSec) {
    setSeenDuration(lesson.shadowDurationSec);
    setDurationText(String(lesson.shadowDurationSec));
  }

  const [marksCleared, setMarksCleared] = useState(false);
  const set = <K extends keyof AdminLesson>(key: K, value: AdminLesson[K]) => {
    touch();
    const resetsTiming = (key === "shadowText" || key === "shadowAudioUrl") && draft.shadowMarks.length > 0;
    if (resetsTiming) setMarksCleared(true);
    else if (key === "shadowMarks") setMarksCleared(false);
    setDraft((d) => ({ ...d, [key]: value, ...(resetsTiming ? { shadowMarks: [] } : {}) }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, title, status, subjectIds, shadowText, shadowAudioUrl, passage, prompt } = draft;
    const shadowDurationSec = durationText.trim() === "" ? 0 : Number(durationText);
    const shadowMarks = draft.shadowMarks.length === splitSentences(shadowText).length ? draft.shadowMarks : [];
    const input = { title, status, subjectIds, shadowText, shadowAudioUrl, shadowDurationSec, shadowMarks, passage, prompt };
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

        <SentenceTimer
          text={draft.shadowText}
          src={audioPreviewUrl || draft.shadowAudioUrl || undefined}
          marks={draft.shadowMarks}
          onChange={(m) => set("shadowMarks", m)}
          cleared={marksCleared}
          error={errors.shadowMarks}
        />

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
        onConfirmed={(sec) => {
          setDurationText(String(sec));
          setDraft((d) => ({ ...d, shadowMarks: [] }));
        }}
      />
    </div>
  );
}
