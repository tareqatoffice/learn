"use client";

import { useState } from "react";
import { setNoteReadAction } from "@/app/(app)/notes/actions";
import { Button } from "@/components/ui/button";

/** Toggles the chapter's read state; the label flips to "Read ✓" once saved optimistically. */
export function MarkReadButton({ noteId, initialRead }: { noteId: string; initialRead: boolean }) {
  const [read, setRead] = useState(initialRead);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const next = !read;
    setRead(next);
    setPending(true);
    setFailed(false);
    try {
      await setNoteReadAction(noteId, next);
    } catch {
      setRead(!next);
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant={read ? "outline" : "default"} aria-pressed={read} onClick={toggle} disabled={pending}>
        {read ? "Read ✓" : "Mark as read"}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Could not save. Try again.
        </p>
      )}
    </div>
  );
}
