"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTokenAction, revokeTokenAction } from "@/app/(app)/admin/tokens/actions";
import { inputClass } from "@/components/admin/SaveBar";
import { Button } from "@/components/ui/button";

type Row = { id: string; name: string; createdAt: string; lastUsedAt?: string; revokedAt?: string };

export function TokensEditor({ tokens }: { tokens: Row[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      setError(null);
      setCopied(false);
      const r = await createTokenAction(name);
      if (!r.ok) return setError(r.error);
      setFresh(r.token);
      setName("");
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <input aria-label="Token name" placeholder="Name, e.g. laptop CLI" className={`${inputClass} max-w-xs`} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={pending}>
          Create token
        </Button>
        {error && (
          <span role="alert" className="self-center text-sm text-destructive">
            {error}
          </span>
        )}
      </form>

      {fresh && (
        <div role="status" className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Copy this token now. It will not be shown again.</p>
          <code className="break-all rounded bg-background p-2 font-mono text-xs">{fresh}</code>
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fresh);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
        {tokens.length === 0 && <li className="px-4 py-2 text-muted-foreground">No tokens yet.</li>}
        {tokens.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
            <span>
              <span className="font-medium">{t.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                created {t.createdAt}
                {t.lastUsedAt ? ` · last used ${t.lastUsedAt}` : " · never used"}
                {t.revokedAt ? ` · revoked ${t.revokedAt}` : ""}
              </span>
            </span>
            {!t.revokedAt && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    if (!window.confirm(`Revoke "${t.name}"? Anything using it stops working.`)) return;
                    await revokeTokenAction(t.id);
                    router.refresh();
                  })
                }
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
