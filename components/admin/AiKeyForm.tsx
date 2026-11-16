"use client";

import { useState } from "react";
import { clearAiKeyAction, saveAiKeyAction } from "@/app/(app)/admin/ai/actions";
import { ActionStatus, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { AiKeySource } from "@/lib/aiSettings";

const API_KEY_MAX = 300;

export function AiKeyForm({
  source,
  hint,
  updatedAt,
  unreadable,
}: {
  source: AiKeySource;
  hint?: string;
  updatedAt?: string;
  unreadable: boolean;
}) {
  const [key, setKey] = useState("");
  const [savedText, setSavedText] = useState("Saved.");
  const { run, pending, errors, saved, touch } = useAdminAction();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => saveAiKeyAction(key), {
      onSuccess: ({ verified: v }) => {
        setKey("");
        setSavedText(
          v.status === "valid"
            ? `Key saved and verified${v.label ? ` (${v.label})` : ""}${v.freeTier ? ". It is on OpenRouter's free tier." : "."}`
            : "Key saved, but OpenRouter could not be reached to verify it. Use Test models below to check.",
        );
      },
    });
  };

  const remove = () =>
    run(() => clearAiKeyAction(), {
      confirm: "Remove the saved key? The coach falls back to OPENROUTER_API_KEY, or turns off without it.",
      onSuccess: () => setSavedText("Saved key removed."),
    });

  const status =
    source === "settings" ? (
      <>
        Using the key saved here, ending in <code>…{hint}</code>
        {updatedAt && <span className="text-muted-foreground"> · saved {updatedAt}</span>}. It overrides{" "}
        <code>OPENROUTER_API_KEY</code>.
      </>
    ) : source === "env" ? (
      <>
        Using <code>OPENROUTER_API_KEY</code> from the environment. A key saved here replaces it.
      </>
    ) : (
      <>
        <strong>No key yet.</strong> Create one at{" "}
        <a href="https://openrouter.ai/keys" className="underline" target="_blank" rel="noreferrer">
          openrouter.ai/keys
        </a>{" "}
        (a free account works with free models). The coach stays off until a key is set.
      </>
    );

  return (
    <form onSubmit={save} className="grid gap-3" aria-label="OpenRouter API key">
      <p className="text-sm">{status}</p>
      {unreadable && (
        <p role="alert" className="text-sm text-destructive">
          A saved key can no longer be read (AUTH_SECRET changed). Enter it again or remove it.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          aria-label="New OpenRouter API key"
          placeholder={source === "settings" ? "Paste a new key to replace it" : "sk-or-v1-…"}
          autoComplete="off"
          spellCheck={false}
          maxLength={API_KEY_MAX}
          className={`${inputClass} min-w-0 flex-1 basis-64 font-mono`}
          value={key}
          onChange={(e) => {
            touch();
            setKey(e.target.value);
          }}
        />
        <Button type="submit" disabled={pending || !key.trim()}>
          {pending ? "Checking…" : "Save key"}
        </Button>
        {(source === "settings" || unreadable) && (
          <Button type="button" variant="outline" disabled={pending} onClick={remove}>
            Remove saved key
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Stored encrypted with AUTH_SECRET and never shown again. Changing AUTH_SECRET means entering it again.
      </p>
      <ActionStatus saved={saved} errors={errors} savedText={savedText} />
    </form>
  );
}
