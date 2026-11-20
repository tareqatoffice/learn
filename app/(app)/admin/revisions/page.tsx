import Link from "next/link";
import { listRevisionsAdmin } from "@/features/admin/queries";
import { AdminList, AdminListItem, AdminPage } from "@/features/admin/components/layout";
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
    <AdminPage
      title="Revisions"
      description="The last 100 edits. Each row is the version before that edit; open its history to view or restore it."
    >
      <AdminList empty="No edits yet." className="text-sm">
        {revisions.map((r) => (
          <AdminListItem
            key={r.id}
            actions={
              <span className="text-xs text-muted-foreground">
                {r.editedBy} · {formatDateTime(r.editedAt)}
              </span>
            }
          >
            <Link href={`/admin/revisions/${r.entityType}/${r.entityId}`} className="hover:underline">
              {r.entityType} ·{" "}
              {String(r.snapshot.title ?? r.snapshot.question ?? r.snapshot.name ?? r.entityId).slice(0, 80)}
            </Link>
          </AdminListItem>
        ))}
      </AdminList>
    </AdminPage>
  );
}
