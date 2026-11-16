"use client";

import { BookOpen, MessagesSquare, Network, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "@/components/Toast";
import type { SearchHit } from "@/content/queries/search";
import { lockPageScroll } from "@/lib/scrollLock";
import { SEARCH_EVENT } from "@/lib/searchBus";
import { cn } from "@/lib/utils";

/** Matches SEARCH_MIN in content/queries/search.ts; below it the server has nothing to match on. */
const MIN_CHARS = 2;
/** Long enough that a fast typist sends one request per word, short enough to feel immediate. */
const DEBOUNCE_MS = 180;

const KIND = {
  book: { icon: MessagesSquare, label: "Book" },
  graph: { icon: Network, label: "Graph" },
  series: { icon: BookOpen, label: "Series" },
  question: { icon: MessagesSquare, label: "Question" },
  topic: { icon: Network, label: "Topic" },
  chapter: { icon: BookOpen, label: "Chapter" },
} as const;

/**
 * Search across every content type, on ⌘K / Ctrl+K or the header's search button. Mounted once by
 * the (app) layout — a native <dialog> so the browser traps focus, makes the page inert and gives
 * focus back to whatever opened it, the same way the topic reader does.
 */
export function CommandPalette() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  // Results carry the term they answer. Everything the list shows is then derived from whether
  // that term is still the one in the box, so results for "clo" can never be shown — or opened
  // with Enter — while the box says "closure", and no effect has to clear them.
  const [result, setResult] = useState<{ term: string; hits: SearchHit[]; failed: boolean }>({
    term: "",
    hits: [],
    failed: false,
  });
  const [at, setAt] = useState(0);
  // Bumped by "Try again" after a failed search, to send the same term once more.
  const [retry, setRetry] = useState(0);
  const trimmed = term.trim();
  const short = trimmed.length < MIN_CHARS;
  const answered = result.term === trimmed;
  const shown = !short && answered ? result.hits : [];
  const busy = !short && !answered;
  // The term can shrink the list under a selection made against a longer one.
  const active = Math.min(at, Math.max(0, shown.length - 1));

  // Closing is what resets the palette, so the next opening always starts clean without an effect
  // writing state on the way in.
  const close = useCallback(() => {
    setOpen(false);
    setTerm("");
    setResult({ term: "", hits: [], failed: false });
    setAt(0);
  }, []);

  // ⌘K from anywhere, plus the header button's event. Re-subscribed per open state so the handler
  // closes through `close()` (which resets) rather than flipping a flag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.defaultPrevented) return;
      e.preventDefault();
      if (open) close();
      else setOpen(true);
    };
    const onEvent = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(SEARCH_EVENT, onEvent);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(SEARCH_EVENT, onEvent);
    };
  }, [open, close]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  // One request per settled term; an earlier one still in flight is abandoned, so a slow
  // response for "clo" can never overwrite the results for "closure".
  useEffect(() => {
    if (!open || short) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { hits: SearchHit[] };
        setResult({ term: trimmed, hits: body.hits, failed: false });
        setAt(0);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        // Recorded against this term too, so the list stops saying it is still searching.
        setResult({ term: trimmed, hits: [], failed: true });
        toast("Search is not answering. Try again in a moment.", "error");
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed, open, short, retry]);

  // Arrow keys can move the selection past the visible part of a long list.
  useEffect(() => {
    if (!shown.length) return;
    document.getElementById(`${listId}-option-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, shown.length, listId]);

  function go(hit: SearchHit) {
    close();
    router.push(hit.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      // Steps from the visible selection, not the raw index, which a shorter list may have clamped.
      setAt((active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
      return;
    }
    if (e.key === "Enter" && shown[active]) {
      e.preventDefault();
      go(shown[active]);
    }
  }

  const optionId = (i: number) => `${listId}-option-${i}`;

  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // A click on the backdrop (the dialog itself, outside the panel) closes it.
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      onClose={close}
      className="m-0 mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-xl overflow-visible rounded-xl border border-border bg-popover p-0 text-foreground shadow-2xl backdrop:bg-black/50 animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none sm:w-full"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          autoFocus
          type="text"
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown.length ? optionId(active) : undefined}
          aria-label="Search questions, topics and chapters"
          placeholder="Search questions, topics and chapters…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onInputKey}
          // The dialog itself is the focus context, so the field skips the global field ring.
          data-chrome="bare"
          className="h-12 w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
        {/* One live region for every outcome, so a screen reader hears the count change as it types. */}
        <p role="status" className="sr-only">
          {short ? "" : busy ? "Searching" : `${shown.length} results`}
        </p>
        {short ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Type at least {MIN_CHARS} characters.
          </p>
        ) : shown.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-2 py-6 text-center text-sm text-muted-foreground">
            <p>
              {busy
                ? "Searching…"
                : result.failed
                  ? "Search is not answering."
                  : "Nothing matched. Try fewer words."}
            </p>
            {!busy && result.failed && (
              <button
                type="button"
                onClick={() => {
                  setResult({ term: "", hits: [], failed: false });
                  setRetry((n) => n + 1);
                }}
                className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Try again
              </button>
            )}
          </div>
        ) : null}
        {/* Always in the page, empty or not, so the input's aria-controls points at something. */}
        <ul id={listId} role="listbox" aria-label="Results" className="grid gap-0.5 empty:hidden">
            {shown.map((hit, i) => {
              const { icon: Icon, label } = KIND[hit.kind];
              return (
                <li key={`${hit.kind}-${hit.href}`} role="presentation">
                  <button
                    type="button"
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    onPointerMove={() => setAt(i)}
                    onClick={() => go(hit)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left",
                      i === active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{hit.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {label} · {hit.context}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
      </div>

      <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          <kbd className="rounded border border-border px-1">↑</kbd>{" "}
          <kbd className="rounded border border-border px-1">↓</kbd> to move
        </span>
        <span>
          <kbd className="rounded border border-border px-1">Enter</kbd> to open
        </span>
        <span className="ml-auto">
          <kbd className="rounded border border-border px-1">Esc</kbd> to close
        </span>
      </div>
    </dialog>
  );
}
