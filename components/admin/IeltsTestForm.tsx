"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  confirmSectionAudioAction,
  deleteTestAction,
  saveTestAction,
  startSectionAudioUploadAction,
} from "@/app/(app)/admin/ielts/tests/actions";
import type { AdminTest, PublishStatus, TestKind } from "@/admin/ieltsTests";
import { Field, TextField } from "@/components/admin/fields";
import { ActionStatus, SaveBar, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { audioDuration } from "@/lib/audioDuration";
import { putFile } from "@/lib/uploadFile";
import { UploadError } from "@/lib/uploadTake";

type SectionDraft = { title: string; passage: string; script: string; questions: string; audioKey: string };
const MAX_SECTIONS: Record<TestKind, number> = { reading: 3, listening: 4 };
const BACK = "/admin/ielts/tests";

const SYNTAX = `## tfng | Do the statements agree with the passage?
The earth is flat. => FALSE ~ optional explanation

## mcq | Choose the correct letter.
What is the main idea? => B
  A. first option
  B. second option

## matching | Match each person with an opinion.
> A. Opinion one
> B. Opinion two
Anna => B

## completion | Write NO MORE THAN TWO WORDS.
The ___ is large. => big | huge`;

function SectionAudio({ testId, index, audioKey, onDone }: { testId: string; index: number; audioKey: string; onDone: (key: string) => void }) {
  const { run, pending, errors, setErrors, saved } = useAdminAction();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const upload = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setErrors({});
    try {
      const started = await startSectionAudioUploadAction(testId, index, file.type, file.size);
      if (!started.ok) {
        setErrors(started.errors);
        return;
      }
      await putFile(started.uploadUrl, file, setProgress);
      const duration = await audioDuration(file);
      run(() => confirmSectionAudioAction(testId, index, started.key, duration), { onSuccess: () => onDone(started.key) });
    } catch (e) {
      setErrors({ _: e instanceof UploadError ? e.message : "The upload failed. Try again." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field label="Audio file" group>
      <FileDropzone
        label="Upload section audio"
        accept="audio/*"
        icon="audio"
        disabled={pending}
        busy={busy}
        progress={progress}
        hint="Audio only, 80 MB at most. Without a file, learners hear the script read by their browser's voice."
        files={audioKey ? [{ name: audioKey.split("/").pop() ?? audioKey, size: 0 }] : []}
        onFiles={([file]) => void upload(file)}
      />
      <ActionStatus saved={saved && !busy} errors={errors} savedText="Audio uploaded." />
    </Field>
  );
}

/** Create or edit a Reading or Listening test: sections, each with its text and questions in the plain-text format. */
export function IeltsTestForm({ kind, test }: { kind: TestKind; test?: AdminTest }) {
  const router = useRouter();
  const [id] = useState(test?.id ?? "");
  const [title, setTitle] = useState(test?.title ?? "");
  const [status, setStatus] = useState<PublishStatus>(test?.status ?? "draft");
  const [sections, setSections] = useState<SectionDraft[]>(
    test?.sections.map((s) => ({ title: s.title, passage: s.passage, script: s.script, questions: s.questions, audioKey: s.audioKey })) ?? [
      { title: kind === "reading" ? "Passage 1" : "Section 1", passage: "", script: "", questions: "", audioKey: "" },
    ],
  );
  // Uploads go to a saved section by position, so once a section has been removed here, save before uploading.
  const [removed, setRemoved] = useState(false);
  const { run, pending, errors, saved, touch } = useAdminAction();
  const del = useAdminAction();

  const patch = (i: number, p: Partial<SectionDraft>) => {
    touch();
    setSections((all) => all.map((s, j) => (j === i ? { ...s, ...p } : s)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      title,
      status,
      sections: sections.map((s) => ({ title: s.title, passage: s.passage, script: s.script, questions: s.questions, audioKey: s.audioKey })),
    };
    if (id) run(() => saveTestAction(kind, id, input));
    else run(() => saveTestAction(kind, null, input), { refresh: false, onSuccess: (r) => router.push(`${BACK}/${kind}/${r.id}`) });
  };

  return (
    <form className="grid gap-6" onSubmit={submit} aria-label={`${kind} test`}>
      <TextField label="Title" value={title} error={errors.title} onChange={(v) => { touch(); setTitle(v); }} />
      <Field label="Status" group error={errors.status}>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          <Chip on={status === "draft"} onClick={() => { touch(); setStatus("draft"); }}>Draft</Chip>
          <Chip on={status === "published"} onClick={() => { touch(); setStatus("published"); }}>Published</Chip>
        </div>
      </Field>
      {errors.sections && <p role="alert" className="text-sm text-destructive">{errors.sections}</p>}

      {sections.map((s, i) => (
        <fieldset key={i} className="grid gap-4 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">{kind === "reading" ? `Passage ${i + 1}` : `Section ${i + 1}`}</legend>
          <TextField label="Section title" value={s.title} error={errors[`sections.${i}.title`]} onChange={(v) => patch(i, { title: v })} />
          {kind === "reading" ? (
            <Field label="Passage" error={errors[`sections.${i}.passage`]}>
              <textarea className={inputClass} rows={12} value={s.passage} onChange={(e) => patch(i, { passage: e.target.value })} />
            </Field>
          ) : (
            <>
              <Field label="Script (shown after the test, and read aloud when there is no audio file)">
                <textarea className={inputClass} rows={8} value={s.script} onChange={(e) => patch(i, { script: e.target.value })} />
              </Field>
              {id && test?.sections[i] && !removed ? (
                <SectionAudio testId={id} index={i} audioKey={s.audioKey} onDone={(key) => patch(i, { audioKey: key })} />
              ) : (
                <p className="text-sm text-muted-foreground">Save the test first, then upload this section&apos;s audio.</p>
              )}
            </>
          )}
          <Field label="Questions" error={errors[`sections.${i}.questions`]}>
            <textarea className={`${inputClass} font-mono`} rows={12} value={s.questions} onChange={(e) => patch(i, { questions: e.target.value })} />
          </Field>
          {sections.length > 1 && (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => { touch(); setRemoved(true); setSections((all) => all.filter((_, j) => j !== i)); }}>
                Remove this section
              </Button>
            </div>
          )}
        </fieldset>
      ))}

      {sections.length < MAX_SECTIONS[kind] && (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => { touch(); setSections((all) => [...all, { title: `${kind === "reading" ? "Passage" : "Section"} ${all.length + 1}`, passage: "", script: "", questions: "", audioKey: "" }]); }}
          >
            Add a section
          </Button>
        </div>
      )}

      <details className="rounded-md border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Question format</summary>
        <p className="mt-2 text-muted-foreground">
          One group per type. Questions are numbered automatically across the test. Several accepted answers are separated by |.
        </p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{SYNTAX}</pre>
      </details>

      <SaveBar label={id ? "Save test" : "Create test"} pending={pending} saved={saved} errors={{}}>
        {id && (
          <Button
            type="button"
            variant="outline"
            disabled={del.pending}
            onClick={() =>
              del.run(() => deleteTestAction(kind, id), {
                confirm: "Delete this test? Learners' past attempts keep their own copy.",
                refresh: false,
                onSuccess: () => router.push(BACK),
              })
            }
          >
            Delete test
          </Button>
        )}
      </SaveBar>
      <ActionStatus saved={false} errors={errors._ ? { _: errors._ } : {}} />
      <ActionStatus saved={false} errors={del.errors} />
    </form>
  );
}
