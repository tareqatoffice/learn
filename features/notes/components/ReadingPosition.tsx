"use client";

import { useEffect } from "react";
import { saveNotePositionAction } from "@/app/(app)/notes/actions";

const SAVE_DELAY_MS = 1500;
const TOP_OFFSET_PX = 140;

type Heading = { anchor: string; id: string };

export function ReadingPosition({
  noteId,
  headings,
  initialAnchor,
}: {
  noteId: string;
  headings: Heading[];
  initialAnchor?: string;
}) {
  useEffect(() => {
    let saved: string | null | undefined = initialAnchor;
    let timer: number | undefined;

    const current = (): string | undefined => {
      let found: string | undefined;
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= TOP_OFFSET_PX) found = h.anchor;
        else break;
      }
      return found;
    };

    const save = () => {
      timer = undefined;
      const anchor = current() ?? null;
      if (anchor === (saved ?? null)) return;
      const previous = saved;
      saved = anchor;
      void saveNotePositionAction(noteId, anchor).catch(() => {
        saved = previous;
      });
    };

    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(save, SAVE_DELAY_MS);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };

    window.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("scroll", schedule);
      document.removeEventListener("visibilitychange", onHide);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [noteId, headings, initialAnchor]);

  return null;
}
