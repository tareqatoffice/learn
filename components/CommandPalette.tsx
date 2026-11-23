"use client";

import { BookOpen, MessagesSquare, Network, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { SearchHit } from "@/lib/searchTypes";
import { lockPageScroll } from "@/lib/scrollLock";
import { SEARCH_EVENT } from "@/lib/searchBus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 180;

const KIND = {
  book: { icon: MessagesSquare, label: "Book" },
  graph: { icon: Network, label: "Graph" },
  series: { icon: BookOpen, label: "Series" },
  question: { icon: MessagesSquare, label: "Question" },
  topic: { icon: Network, label: "Topic" },
  chapter: { icon: BookOpen, label: "Chapter" },
} as const;

export function CommandPalette() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<{ term: string; hits: SearchHit[]; failed: boolean }>({
    term: "",
    hits: [],
    failed: false,
  });
  const [at, setAt] = useState(0);
  const [retry, setRetry] = useState(0);
  const trimmed = term.trim();
  const short = trimmed.length < MIN_CHARS;
  const answered = result.term === trimmed;
  const shown = !short && answered ? result.hits : [];
  const busy = !short && !answered;
  const active = Math.min(at, Math.max(0, shown.length - 1));

  const close = useCallback(() => {
    setOpen(false);
    setTerm("");
    setResult({ term: "", hits: [], failed: false });
    setAt(0);
  }, []);

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
        setResult({ term: trimmed, hits: [], failed: true });
        toast.error("Search is not answering. Try again in a moment.");
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed, open, short, retry]);

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
          data-chrome="bare"
          className="h-12 w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult({ term: "", hits: [], failed: false });
                  setRetry((n) => n + 1);
                }}
              >
                Try again
              </Button>
            )}
          </div>
        ) : null}
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
