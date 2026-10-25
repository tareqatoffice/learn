"use client";

import { useActionState, useState } from "react";
import { sendRequestNoteAction, type NoteState } from "@/app/access/actions";
import { Button } from "@/components/ui/button";
import { REQUEST_NOTE_MAX, REQUEST_NOTE_MIN } from "@/lib/access-limits";
import { cn } from "@/lib/utils";

/** Lets a pending user tell the reviewing admin who they are; validated here and again on the server. */
export function AccessRequestForm({ savedNote }: { savedNote?: string }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(sendRequestNoteAction, null);
  const [note, setNote] = useState(savedNote ?? "");
  const [touched, setTouched] = useState(false);

  const length = note.trim().length;
  const localError =
    length < REQUEST_NOTE_MIN
      ? `Tell the admin a little more (at least ${REQUEST_NOTE_MIN} characters)`
      : length > REQUEST_NOTE_MAX
        ? `Keep it under ${REQUEST_NOTE_MAX} characters`
        : null;
  const showLocal = touched && localError;
  const serverError = state && !state.ok ? state.message : null;
  const error = showLocal ? localError : serverError;

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        setTouched(true);
        if (localError) e.preventDefault();
      }}
      className="grid gap-2"
    >
      <label htmlFor="access-note" className="text-sm font-medium">
        {savedNote ? "Your note to the admin" : "Add a note for the admin (optional)"}
      </label>
      <p id="access-note-hint" className="text-xs text-muted-foreground">
        Who are you, and why do you want access? It helps the admin recognise you.
      </p>
      <textarea
        id="access-note"
        name="note"
        rows={4}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note && setTouched(true)}
        aria-invalid={!!error}
        aria-describedby={cn("access-note-hint", error ? "access-note-error" : "access-note-count")}
        placeholder="e.g. I'm on the backend team and preparing for system design interviews."
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? (
          <p id="access-note-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : state?.ok ? (
          <p role="status" className="text-sm text-ok">
            {state.message}
          </p>
        ) : (
          <span />
        )}
        <span
          id="access-note-count"
          className={cn("text-xs tabular-nums text-muted-foreground", length > REQUEST_NOTE_MAX && "text-destructive")}
        >
          {length}/{REQUEST_NOTE_MAX}
        </span>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {pending ? "Sending…" : savedNote ? "Update note" : "Send note"}
      </Button>
    </form>
  );
}
