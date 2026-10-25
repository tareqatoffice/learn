"use client";

import { useState, useTransition } from "react";
import { saveQuestionAction, searchTopicsAction, setQuestionTopicLinkAction } from "@/app/(app)/admin/books/actions";
import type { AdminQuestion } from "@/admin/queries";
import { Field, StatusField, SubjectsField, TextField } from "@/components/admin/fields";
import { inputClass, SaveBar } from "@/components/admin/SaveBar";
import { useSaveForm, withoutEmptyId } from "@/components/admin/useSaveForm";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { Button } from "@/components/ui/button";

type Topic = { id: string; title: string; graphTitle: string };

export function QuestionForm({
  question,
  parts,
  subjects,
  topics: initialTopics = [],
}: {
  question: AdminQuestion;
  parts: { key: string; title: string }[];
  subjects: { slug: string; name: string }[];
  topics?: Topic[];
}) {
  const { draft, set, errors, setErrors, saved, pending, submit } = useSaveForm(
    question,
    (d) => saveQuestionAction(withoutEmptyId(d)),
    (id) => `/admin/books/${question.bookId}/questions/${id}`,
  );
  const [, startTransition] = useTransition();
  const [topics, setTopics] = useState(initialTopics);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Topic[] | null>(null);

  const searchTopics = () => startTransition(async () => setResults(await searchTopicsAction(search, draft.subjects)));

  function link(topic: Topic, linked: boolean) {
    startTransition(async () => {
      const result = await setQuestionTopicLinkAction(draft.id, topic.id, linked);
      if (!result.ok) return setErrors(result.errors);
      setTopics((t) => (linked ? [...t.filter((x) => x.id !== topic.id), topic] : t.filter((x) => x.id !== topic.id)));
    });
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <TextField label="Question (inline markdown)" value={draft.question} onChange={(v) => set("question", v)} error={errors.question} />
        <Field label="Part" error={errors.partKey}>
          <select className={inputClass} value={draft.partKey} onChange={(e) => set("partKey", e.target.value)}>
            {parts.map((p) => (
              <option key={p.key} value={p.key}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <StatusField value={draft.status} onChange={(s) => set("status", s)} />

      <MarkdownEditor label="Prompt (shown before the answer)" value={draft.prompt} onChange={(v) => set("prompt", v)} rows={4} />
      <MarkdownEditor label="Answer" value={draft.answer} onChange={(v) => set("answer", v)} rows={12} error={errors.answer} />

      <SubjectsField options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />

      {draft.id && (
        <fieldset className="grid gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">Linked graph topics</legend>
          {topics.length === 0 && <p className="text-sm text-muted-foreground">Not linked to any topic.</p>}
          <ul className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm">
                {t.graphTitle} › {t.title}
                <button
                  type="button"
                  aria-label={`Unlink ${t.title}`}
                  className="ml-1 inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:size-9"
                  onClick={() => link(t, false)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              aria-label="Search topics"
              placeholder="Search topics by title"
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Enter would submit (save) the question form; here it runs the search instead.
                if (e.key !== "Enter") return;
                e.preventDefault();
                searchTopics();
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={searchTopics}>
              Search
            </Button>
          </div>
          {results && (
            <ul className="grid gap-1 text-sm">
              {results.length === 0 && <li className="text-muted-foreground">No topics found in these subjects.</li>}
              {results
                .filter((r) => !topics.some((t) => t.id === r.id))
                .map((r) => (
                  <li key={r.id}>
                    <button type="button" className="hover:underline" onClick={() => link(r, true)}>
                      + {r.graphTitle} › {r.title}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </fieldset>
      )}

      <SaveBar label="Save question" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
