"use client";

import { useState, useTransition } from "react";
import {
  searchNotesAction,
  searchQuestionsAction,
  setNodeNoteLinkAction,
  setNodeQuestionLinkAction,
} from "@/app/(app)/admin/graphs/actions";
import type { AdminRelated } from "@/admin/queries";
import { inputClass } from "@/components/admin/SaveBar";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown/Markdown";

type NoteHit = { id: string; title: string; toc: { anchor: string; text: string }[] };

/** Links a topic to interview questions (searched within the graph's subjects) and to note chapters or headings. */
export function RelatedPicker({ nodeId, subjects, initial }: { nodeId: string; subjects: string[]; initial: AdminRelated }) {
  const [related, setRelated] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qSearch, setQSearch] = useState("");
  const [qHits, setQHits] = useState<{ id: string; title: string }[] | null>(null);
  const [nSearch, setNSearch] = useState("");
  const [nHits, setNHits] = useState<NoteHit[] | null>(null);
  const [note, setNote] = useState<NoteHit | null>(null);
  const [anchor, setAnchor] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; errors?: Record<string, string> }>, apply: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) apply();
      else setError(Object.values(r.errors ?? {})[0] ?? "Failed");
    });

  const linkQuestion = (q: { id: string; title: string }, linked: boolean) =>
    run(
      () => setNodeQuestionLinkAction(nodeId, q.id, linked),
      () => setRelated((r) => ({ ...r, questions: linked ? [...r.questions, q] : r.questions.filter((x) => x.id !== q.id) })),
    );
  const linkNote = (noteId: string, a: string, title: string, linked: boolean) =>
    run(
      () => setNodeNoteLinkAction(nodeId, noteId, a, linked),
      () =>
        setRelated((r) => ({
          ...r,
          notes: linked ? [...r.notes, { noteId, anchor: a, title }] : r.notes.filter((n) => !(n.noteId === noteId && n.anchor === a)),
        })),
    );

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Related content</legend>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Interview questions</h3>
        <ul className="grid gap-1 text-sm">
          {related.questions.length === 0 && <li className="text-muted-foreground">None linked.</li>}
          {related.questions.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-2">
              <Markdown source={q.title} inline />
              <button type="button" className="text-xs underline" disabled={pending} onClick={() => linkQuestion(q, false)}>
                Unlink
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input aria-label="Search questions" placeholder="Search questions" className={inputClass} value={qSearch} onChange={(e) => setQSearch(e.target.value)} />
          <Button type="button" size="sm" variant="outline" onClick={() => startTransition(async () => setQHits(await searchQuestionsAction(qSearch, subjects)))}>
            Search
          </Button>
        </div>
        {qHits && (
          <ul className="grid gap-1 text-sm">
            {qHits.length === 0 && <li className="text-muted-foreground">No questions found in this graph&apos;s subjects.</li>}
            {qHits
              .filter((h) => !related.questions.some((q) => q.id === h.id))
              .map((h) => (
                <li key={h.id}>
                  <button type="button" className="text-left hover:underline" disabled={pending} onClick={() => linkQuestion(h, true)}>
                    + <Markdown source={h.title} inline insideLink />
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        <ul className="grid gap-1 text-sm">
          {related.notes.length === 0 && <li className="text-muted-foreground">None linked.</li>}
          {related.notes.map((n) => (
            <li key={`${n.noteId}#${n.anchor}`} className="flex items-center justify-between gap-2">
              {n.title}
              <button type="button" className="text-xs underline" disabled={pending} onClick={() => linkNote(n.noteId, n.anchor, n.title, false)}>
                Unlink
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input aria-label="Search chapters" placeholder="Search chapters" className={inputClass} value={nSearch} onChange={(e) => setNSearch(e.target.value)} />
          <Button type="button" size="sm" variant="outline" onClick={() => startTransition(async () => setNHits(await searchNotesAction(nSearch)))}>
            Search
          </Button>
        </div>
        {nHits && (
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <select
              aria-label="Chapter"
              className={inputClass}
              value={note?.id ?? ""}
              onChange={(e) => {
                setNote(nHits.find((h) => h.id === e.target.value) ?? null);
                setAnchor("");
              }}
            >
              <option value="">Pick a chapter</option>
              {nHits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title}
                </option>
              ))}
            </select>
            <select aria-label="Heading" className={inputClass} value={anchor} disabled={!note} onChange={(e) => setAnchor(e.target.value)}>
              <option value="">Whole chapter</option>
              {note?.toc.map((t) => (
                <option key={t.anchor} value={t.anchor}>
                  {t.text}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              disabled={!note || pending}
              onClick={() => {
                if (!note) return;
                const heading = note.toc.find((t) => t.anchor === anchor)?.text;
                linkNote(note.id, anchor, heading ? `${note.title} § ${heading}` : note.title, true);
              }}
            >
              Link
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
