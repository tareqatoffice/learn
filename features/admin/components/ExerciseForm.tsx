"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  confirmPhotoAction,
  createExerciseAction,
  deleteExerciseAction,
  removePhotoAction,
  setExerciseArchivedAction,
  startPhotoUploadAction,
  updateExerciseAction,
} from "@/app/(app)/admin/exercises/actions";
import type { AdminExercise, PhotoSlot } from "@/features/admin/exercises";
import { Field, TextField } from "@/features/admin/components/fields";
import { ActionStatus, SaveBar, inputClass } from "@/features/admin/components/SaveBar";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { putFile, UploadError } from "@/lib/uploadFile";
import { EXERCISE_MODES, EXERCISE_TYPES, FOCUSES, type Focus } from "@/models/exerciseConstants";

const EMPTY: AdminExercise = {
  id: "",
  name: "",
  focus: [],
  type: "strength",
  difficulty: 1,
  mode: "reps",
  equipment: "none",
  cues: [],
  order: 0,
  archived: false,
  startPhotoUrl: "",
  endPhotoUrl: "",
};

const DIFFICULTIES = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Hard" },
] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function PhotoUpload({ slug, slot, label, url }: { slug: string; slot: PhotoSlot; label: string; url: string }) {
  const { run, pending, errors, setErrors, saved } = useAdminAction();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setErrors({});
    try {
      const started = await startPhotoUploadAction(slug, file.type, file.size);
      if (!started.ok) {
        setErrors(started.errors);
        return;
      }
      await putFile(started.uploadUrl, file, setProgress);
      run(() => confirmPhotoAction(slug, slot, started.key));
    } catch (e) {
      setErrors({ _: e instanceof UploadError ? e.message : "The upload failed. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label={label} group>
      <div className="grid gap-2">
        {url && (
          <div className="relative aspect-3/2 w-full max-w-xs overflow-hidden rounded-lg bg-muted">
            <Image src={url} alt={label} fill sizes="320px" className="object-cover" />
          </div>
        )}
        <FileDropzone
          label={url ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          busy={busy}
          progress={progress}
          hint="JPEG, PNG or WebP, 5 MB at most. Replacing a photo deletes the old one."
          onFiles={([file]) => void upload(file)}
        />
        {url && (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || busy}
              onClick={() => run(() => removePhotoAction(slug, slot), { confirm: `Remove the ${label.toLowerCase()}? The file is deleted.` })}
            >
              Remove photo
            </Button>
          </div>
        )}
        <ActionStatus saved={saved && !busy} errors={errors} savedText="Photo saved." />
      </div>
    </Field>
  );
}

export function ExerciseForm({
  exercise = EMPTY,
  defaultOrder,
  inUse,
  storageReady,
}: {
  exercise?: AdminExercise;
  defaultOrder: number;
  inUse: boolean;
  storageReady: boolean;
}) {
  const router = useRouter();
  const isNew = !exercise.id;
  const [draft, setDraft] = useState(exercise);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [cuesText, setCuesText] = useState(exercise.cues.join("\n"));
  const [orderText, setOrderText] = useState(String(isNew ? defaultOrder : exercise.order));
  const { run, pending, errors, saved, touch } = useAdminAction();
  const other = useAdminAction();

  const set = <K extends keyof AdminExercise>(key: K, value: AdminExercise[K]) => {
    touch();
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const toggleFocus = (f: Focus) =>
    set("focus", draft.focus.includes(f) ? draft.focus.filter((x) => x !== f) : [...draft.focus, f]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      name: draft.name,
      focus: draft.focus,
      type: draft.type,
      difficulty: draft.difficulty,
      mode: draft.mode,
      equipment: draft.equipment,
      cues: cuesText.split("\n"),
      order: orderText.trim() === "" ? 0 : Number(orderText),
    };
    if (!isNew) run(() => updateExerciseAction(exercise.id, input));
    else
      run(() => createExerciseAction({ ...input, slug: slugEdited ? slug : slugify(draft.name) }), {
        refresh: false,
        onSuccess: (r) => router.push(`/admin/exercises/${r.id}`),
      });
  };

  return (
    <div className="grid gap-5">
      <form className="grid gap-5" onSubmit={submit} aria-label="Exercise">
        <TextField label="Name" value={draft.name} error={errors.name} onChange={(v) => set("name", v)} />
        {isNew ? (
          <TextField
            label="Id (saved plans use it, so it can't change later)"
            value={slugEdited ? slug : slugify(draft.name)}
            error={errors.slug}
            onChange={(v) => {
              touch();
              setSlugEdited(true);
              setSlug(v);
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Id: <code>{exercise.id}</code>
          </p>
        )}

        <Field label="Focus" error={errors.focus} group>
          <div className="flex flex-wrap gap-3">
            {FOCUSES.map((f) => (
              <label key={f} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={draft.focus.includes(f)} onChange={() => toggleFocus(f)} />
                {cap(f)}
              </label>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type" error={errors.type}>
            <select className={inputClass} value={draft.type} onChange={(e) => set("type", e.target.value as AdminExercise["type"])}>
              {EXERCISE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "hiit" ? "HIIT" : cap(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty" error={errors.difficulty}>
            <select
              className={inputClass}
              value={draft.difficulty}
              onChange={(e) => set("difficulty", Number(e.target.value) as AdminExercise["difficulty"])}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Counted by" error={errors.mode}>
            <select className={inputClass} value={draft.mode} onChange={(e) => set("mode", e.target.value as AdminExercise["mode"])}>
              {EXERCISE_MODES.map((m) => (
                <option key={m} value={m}>
                  {m === "reps" ? "Reps" : "Time"}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Equipment" value={draft.equipment} error={errors.equipment} onChange={(v) => set("equipment", v)} />
          <TextField
            label="Library order (lower comes first)"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={orderText}
            error={errors.order}
            onChange={(v) => {
              touch();
              setOrderText(v);
            }}
          />
        </div>

        <Field label="Cues (one per line; the first shows during the workout)" error={errors.cues}>
          <textarea
            className={inputClass}
            rows={4}
            value={cuesText}
            onChange={(e) => {
              touch();
              setCuesText(e.target.value);
            }}
          />
        </Field>

        <SaveBar label={isNew ? "Create exercise" : "Save exercise"} pending={pending} saved={saved} errors={errors}>
          {!isNew && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={other.pending}
                onClick={() =>
                  other.run(() => setExerciseArchivedAction(exercise.id, !exercise.archived), {
                    confirm: exercise.archived ? undefined : "Archive this exercise? New plans stop using it; past workouts keep it.",
                  })
                }
              >
                {exercise.archived ? "Restore" : "Archive"}
              </Button>
              {!inUse && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={other.pending}
                  onClick={() =>
                    other.run(() => deleteExerciseAction(exercise.id), {
                      confirm: "Delete this exercise and its photos? This can't be undone.",
                      refresh: false,
                      onSuccess: () => router.push("/admin/exercises"),
                    })
                  }
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </SaveBar>
        {exercise.archived && <p className="text-sm text-muted-foreground">Archived: hidden from the library and new plans.</p>}
        <ActionStatus saved={false} errors={other.errors} />
      </form>

      {!storageReady ? (
        <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          File storage isn&apos;t configured (set the R2_* environment variables), so photos can&apos;t be uploaded.
        </p>
      ) : isNew ? (
        <p className="text-sm text-muted-foreground">Create the exercise first, then add its photos here.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <PhotoUpload slug={exercise.id} slot="startPhoto" label="Start photo" url={exercise.startPhotoUrl} />
          <PhotoUpload slug={exercise.id} slot="endPhoto" label="End photo" url={exercise.endPhotoUrl} />
        </div>
      )}
    </div>
  );
}
