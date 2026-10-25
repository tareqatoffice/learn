import Link from "next/link";
import { listRevisionsAdmin } from "@/admin/queries";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Revisions · Admin",
  description: "Review and restore earlier versions of content.",
  path: "/admin/revisions",
});

export default async function RevisionsPage() {
  await connectDb();
  const revisions = await listRevisionsAdmin({}, 100);
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Revisions</h1>
      <p className="text-sm text-muted-foreground">
        The last 100 edits. Each row is the version before that edit; open its
        history to view or restore it.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
        {revisions.length === 0 && (
          <li className="px-4 py-2 text-muted-foreground">No edits yet.</li>
        )}
        {revisions.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
          >
            <Link
              href={`/admin/revisions/${r.entityType}/${r.entityId}`}
              className="hover:underline"
            >
              {r.entityType} ·{" "}
              {String(
                r.snapshot.title ??
                  r.snapshot.question ??
                  r.snapshot.name ??
                  r.entityId,
              ).slice(0, 80)}
            </Link>
            <span className="text-xs text-muted-foreground">
              {r.editedBy} · {formatDateTime(r.editedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
