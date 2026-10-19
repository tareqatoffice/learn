"use client";

import { useState, useTransition } from "react";
import { startQuizAction } from "@/app/(app)/interview/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuizMode } from "@/progress/quiz";

export type SetupBook = { id: string; title: string; parts: { key: string; title: string }[] };

const MODES: { value: QuizMode; label: string }[] = [
  { value: "unseen", label: "Not seen yet" },
  { value: "review", label: "Review pile" },
  { value: "all", label: "Everything" },
];
const SIZES: { value: 10 | 20 | 50 | null; label: string }[] = [
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: null, label: "All" },
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mt-5">
      <p className="mb-2 text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function QuizSetup({ books }: { books: SetupBook[] }) {
  const [bookIds, setBookIds] = useState<string[]>([]);
  const [partKeys, setPartKeys] = useState<string[]>([]);
  const [mode, setMode] = useState<QuizMode>("unseen");
  const [size, setSize] = useState<10 | 20 | 50 | null>(20);
  const [empty, setEmpty] = useState(false);
  const [pending, startTransition] = useTransition();

  const single = bookIds.length === 1 ? books.find((b) => b.id === bookIds[0]) : undefined;

  function changeBooks(next: string[]) {
    setBookIds(next);
    setPartKeys([]);
    setEmpty(false);
  }

  function start() {
    setEmpty(false);
    startTransition(async () => {
      // A successful start redirects, so only the empty result ever comes back here.
      const result = await startQuizAction({ bookIds, partKeys: single ? partKeys : [], mode, size });
      if (result?.empty) setEmpty(true);
    });
  }

  return (
    <section aria-labelledby="new-quiz" className="rounded-xl border border-border bg-card p-5">
      <h2 id="new-quiz" className="text-lg font-semibold">
        New quiz
      </h2>

      <Group label="Books">
        <Chip on={bookIds.length === 0} onClick={() => changeBooks([])}>
          All books
        </Chip>
        {books.map((book) => (
          <Chip key={book.id} on={bookIds.includes(book.id)} onClick={() => changeBooks(toggle(bookIds, book.id))}>
            {book.title}
          </Chip>
        ))}
      </Group>

      {single && single.parts.length > 0 && (
        <Group label={`Parts (${single.title})`}>
          <Chip on={partKeys.length === 0} onClick={() => setPartKeys([])}>
            All
          </Chip>
          {single.parts.map((part) => (
            <Chip key={part.key} on={partKeys.includes(part.key)} onClick={() => setPartKeys(toggle(partKeys, part.key))}>
              {part.title}
            </Chip>
          ))}
        </Group>
      )}

      <Group label="Which questions">
        {MODES.map((m) => (
          <Chip key={m.value} on={mode === m.value} onClick={() => setMode(m.value)}>
            {m.label}
          </Chip>
        ))}
      </Group>

      <Group label="Deck size">
        {SIZES.map((s) => (
          <Chip key={s.label} on={size === s.value} onClick={() => setSize(s.value)}>
            {s.label}
          </Chip>
        ))}
      </Group>

      <div className="mt-6">
        <Button type="button" size="lg" disabled={pending} onClick={start}>
          {pending ? "Starting…" : `Start · ${size ? `${size} questions` : "all questions"}`}
        </Button>
        <p role="status" className="mt-3 text-sm text-muted-foreground empty:hidden">
          {empty && "No questions match. Try another mode or book."}
        </p>
      </div>
    </section>
  );
}
