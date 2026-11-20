"use client";

import { useState } from "react";
import { createTokenAction, revokeTokenAction } from "@/app/(app)/admin/tokens/actions";
import { AdminCard, AdminList, AdminListItem, AdminSection } from "@/features/admin/components/layout";
import { ActionStatus, inputClass } from "@/features/admin/components/SaveBar";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { Button } from "@/components/ui/button";
import type { TokenLifetime } from "@/features/admin/tokens";
import type { TokenScope } from "@/models";

type Row = {
  id: string;
  name: string;
  createdAt: string;
  scope: TokenScope;
  expiresAt?: string;
  expired: boolean;
  lastUsedAt?: string;
  revokedAt?: string;
};

const LIFETIMES: { value: string; label: string; days: TokenLifetime }[] = [
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "1 year", days: 365 },
  { value: "never", label: "Never", days: null },
];

export function TokensEditor({ tokens }: { tokens: Row[] }) {
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [scope, setScope] = useState<TokenScope>("read");
  const [lifetime, setLifetime] = useState("90");
  const create = useAdminAction();
  const revoke = useAdminAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setCopied(false);
    const lifetimeDays = LIFETIMES.find((l) => l.value === lifetime)?.days ?? null;
    create.run(() => createTokenAction(name, { scope, lifetimeDays }), {
      onSuccess: ({ token }) => {
        setFresh(token);
        setName("");
      },
    });
  };

  return (
    <>
      <AdminCard title="New token">
        <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
          <input
            aria-label="Token name"
            placeholder="Name, e.g. laptop CLI"
            className={`${inputClass} max-w-xs`}
            value={name}
            onChange={(e) => {
              create.touch();
              setName(e.target.value);
            }}
          />
          <select aria-label="Access" className={`${inputClass} w-auto`} value={scope} onChange={(e) => setScope(e.target.value as TokenScope)}>
            <option value="read">Read only (list, pull)</option>
            <option value="write">Read and import</option>
          </select>
          <select aria-label="Expires after" className={`${inputClass} w-auto`} value={lifetime} onChange={(e) => setLifetime(e.target.value)}>
            {LIFETIMES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.value === "never" ? "Never expires" : `Expires in ${l.label}`}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={create.pending}>
            Create token
          </Button>
          <ActionStatus saved={false} errors={create.errors} />
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
      </AdminCard>

      <AdminSection title={`Tokens (${tokens.length})`}>
        <AdminList empty="No tokens yet." className="text-sm">
          {tokens.map((t) => (
            <AdminListItem
              key={t.id}
              actions={
                !t.revokedAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.pending}
                    onClick={() =>
                      revoke.run(() => revokeTokenAction(t.id), {
                        confirm: `Revoke "${t.name}"? Anything using it stops working.`,
                      })
                    }
                  >
                    Revoke
                  </Button>
                )
              }
            >
              <span className="font-medium">{t.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {t.scope === "write" ? "read and import" : "read only"} · created {t.createdAt}
                {t.expiresAt ? ` · ${t.expired ? "expired" : "expires"} ${t.expiresAt}` : " · never expires"}
                {t.lastUsedAt ? ` · last used ${t.lastUsedAt}` : " · never used"}
                {t.revokedAt ? ` · revoked ${t.revokedAt}` : ""}
              </span>
            </AdminListItem>
          ))}
        </AdminList>
        <ActionStatus saved={false} errors={revoke.errors} />
      </AdminSection>
    </>
  );
}
