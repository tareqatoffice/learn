"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function TopicReader({
  open,
  onClose,
  onPrev,
  onNext,
  context,
  topicKey,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  context: string;
  topicKey: string;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) closing.current = false;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [open]);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [topicKey]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        if (closing.current) return;
        closing.current = true;
        onClose();
      }}
      onClose={() => {
        if (!open || closing.current) return;
        closing.current = true;
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], pre")) return;
        const go = e.key === "ArrowLeft" ? onPrev : e.key === "ArrowRight" ? onNext : undefined;
        if (!go) return;
        e.preventDefault();
        go();
      }}
      className="topic-reader m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-background p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex max-w-[75rem] items-center gap-2 px-4 py-2.5 sm:px-6">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="-ml-2">
            <X aria-hidden />
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground tabular-nums">{context}</p>
          <Button variant="outline" size="sm" onClick={onPrev} disabled={!onPrev} aria-label="Previous topic" title="Previous topic (←)">
            <ChevronLeft aria-hidden />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!onNext} aria-label="Next topic" title="Next topic (→)">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-[75rem] px-4 py-8 sm:px-6 lg:py-12">{children}</div>
    </dialog>
  );
}
