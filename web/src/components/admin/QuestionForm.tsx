"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveQuestionAction, searchTopicsAction, setQuestionTopicLinkAction } from "@/app/(app)/admin/books/actions";
import type { AdminQuestion } from "@/admin/queries";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { StatusChips } from "@/components/StatusChips";
import { SubjectPicker } from "@/components/SubjectPicker";
import { Button } from "@/components/ui/button";

type Topic = { id: string; title: string; graphTitle: string };
const inputClass = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-ring";

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
  const router = useRouter();
  const [draft, setDraft] = useState(question);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [topics, setTopics] = useState(initialTopics);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Topic[] | null>(null);
  const set = <K extends keyof AdminQuestion>(key: K, value: AdminQuestion[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  function save() {
    startTransition(async () => {
      const { id, ...rest } = draft;
      const result = await saveQuestionAction({ ...(id ? { id } : {}), ...rest });
      if (!result.ok) return setErrors(result.errors);
      setErrors({});
      setSaved(true);
      if (!id) router.push(`/admin/books/${draft.bookId}/questions/${result.id}`);
      else router.refresh();
    });
  }

  function link(topic: Topic, linked: boolean) {
    startTransition(async () => {
      const result = await setQuestionTopicLinkAction(draft.id, topic.id, linked);
      if (!result.ok) return setErrors(result.errors);
      setTopics((t) => (linked ? [...t.filter((x) => x.id !== topic.id), topic] : t.filter((x) => x.id !== topic.id)));
    });
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Question (inline markdown)</span>
          <input className={inputClass} value={draft.question} onChange={(e) => set("question", e.target.value)} />
          {errors.question && <span className="text-destructive">{errors.question}</span>}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Part</span>
          <select className={inputClass} value={draft.partKey} onChange={(e) => set("partKey", e.target.value)}>
            {parts.map((p) => (
              <option key={p.key} value={p.key}>
                {p.title}
              </option>
            ))}
          </select>
          {errors.partKey && <span className="text-destructive">{errors.partKey}</span>}
        </label>
      </div>

      <div className="grid gap-1">
        <span className="text-sm font-medium">Status</span>
        <StatusChips value={draft.status} onChange={(s) => set("status", s)} />
      </div>

      <MarkdownEditor label="Prompt (shown before the answer)" value={draft.prompt} onChange={(v) => set("prompt", v)} rows={4} />
      <MarkdownEditor label="Answer" value={draft.answer} onChange={(v) => set("answer", v)} rows={12} error={errors.answer} />

      <div className="grid gap-1">
        <span className="text-sm font-medium">Subjects</span>
        <SubjectPicker options={subjects} value={draft.subjects} onChange={(v) => set("subjects", v)} />
      </div>

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
                  className="ml-1 text-muted-foreground hover:text-foreground"
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
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startTransition(async () => setResults(await searchTopicsAction(search, draft.subjects)))}
            >
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

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save question"}
        </Button>
        {saved && (
          <span role="status" className="text-sm text-muted-foreground">
            Saved.
          </span>
        )}
        {Object.keys(errors).length > 0 && (
          <span role="alert" className="text-sm text-destructive">
            {Object.values(errors)[0]}
          </span>
        )}
      </div>
    </form>
  );
}
