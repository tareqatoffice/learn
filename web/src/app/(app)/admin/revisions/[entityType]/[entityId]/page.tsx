import Link from "next/link";
import { listRevisionsAdmin } from "@/admin/queries";
import { RestoreButton } from "@/components/admin/RestoreButton";
import { connectDb } from "@/lib/db";

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function EntityHistoryPage({ params }: { params: Promise<{ entityType: string; entityId: string }> }) {
  const { entityType, entityId } = await params;
  await connectDb();
  const revisions = await listRevisionsAdmin({ entityType, entityId }, 200);

  return (
    <section className="grid gap-4">
      <Link href="/admin/revisions" className="text-sm text-muted-foreground hover:underline">
        ← Revisions
      </Link>
      <h1 className="text-2xl font-semibold">
        History · {entityType} <span className="font-mono text-base text-muted-foreground">{entityId}</span>
      </h1>
      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No earlier versions.</p>
      ) : (
        <ol className="grid gap-3">
          {revisions.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  Version before the edit by <strong>{r.editedBy || "unknown"}</strong> on {when.format(r.editedAt)}
                </span>
                <RestoreButton revisionId={r.id} />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-muted-foreground">View snapshot</summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(r.snapshot, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
