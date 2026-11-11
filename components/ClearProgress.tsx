"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearProgressAction } from "@/app/(app)/interview/actions";
import { Chip } from "@/components/Chip";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { toggleItem } from "@/lib/utils";

export type ClearBook = { id: string; title: string };

/** Picks all books or some of them and clears the user's question progress there, after a confirm. */
export function ClearProgress({ books }: { books: ClearBook[] }) {
  const router = useRouter();
  const [bookIds, setBookIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = books.filter((b) => bookIds.includes(b.id));
  const scope = !bookIds.length ? "all books" : chosen.length === 1 ? `“${chosen[0].title}”` : `${chosen.length} books`;

  function change(next: string[]) {
    setBookIds(next);
    setMessage(null);
  }

  function clear() {
    if (!window.confirm(`Clear your progress in ${scope}? Mastered, review and seen marks are removed, so those questions count as not seen yet. This cannot be undone.`)) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const { cleared } = await clearProgressAction(bookIds);
        setMessage(
          cleared
            ? { tone: "ok", text: `Cleared progress on ${cleared} question${cleared === 1 ? "" : "s"}.` }
            : { tone: "info", text: "There was no progress to clear." },
        );
        // Keep the selection: resetting it would arm the button for "all books".
        router.refresh();
      } catch {
        setMessage({ tone: "error", text: "Could not clear progress. Try again." });
      }
    });
  }

  return (
    <section aria-labelledby="clear-progress" className="rounded-xl border border-border bg-card p-5">
      <h2 id="clear-progress" className="text-lg font-semibold">
        Clear progress
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Start books over. Quiz history is kept.</p>

      <div role="group" aria-label="Books to clear" className="mt-4 flex flex-wrap gap-2">
        <Chip on={bookIds.length === 0} onClick={() => change([])} disabled={pending}>
          All books
        </Chip>
        {books.map((book) => (
          <Chip key={book.id} on={bookIds.includes(book.id)} onClick={() => change(toggleItem(bookIds, book.id))} disabled={pending}>
            {book.title}
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <Button type="button" variant="destructive" className="justify-self-start" disabled={pending} onClick={clear}>
          {pending ? "Clearing…" : `Clear progress in ${scope}`}
        </Button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </section>
  );
}
