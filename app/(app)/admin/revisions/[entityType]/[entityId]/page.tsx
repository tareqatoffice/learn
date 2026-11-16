import { listRevisionsAdmin } from "@/admin/queries";
import { RestoreButton } from "@/components/admin/RestoreButton";
import { AdminList, AdminListItem, AdminPage } from "@/components/admin/layout";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function EntityHistoryPage({
  params,
}: {
  params: Promise<{ entityType: string; entityId: string }>;
}) {
  const { entityType, entityId } = await params;
  await connectDb();
  const revisions = await listRevisionsAdmin({ entityType, entityId }, 200);

  return (
    <AdminPage
      back={{ href: "/admin/revisions", label: "Revisions" }}
      title={
        <>
          History · {entityType} <span className="font-mono text-base text-muted-foreground">{entityId}</span>
        </>
      }
    >
      <AdminList empty="No earlier versions." label="Earlier versions">
        {revisions.map((r) => (
          <AdminListItem key={r.id} className="items-start py-3" actions={<RestoreButton revisionId={r.id} />}>
            <span className="text-sm">
              Version before the edit by <strong>{r.editedBy || "unknown"}</strong> on {formatDateTime(r.editedAt)}
            </span>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">View snapshot</summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(r.snapshot, null, 2)}</pre>
            </details>
          </AdminListItem>
        ))}
      </AdminList>
    </AdminPage>
  );
}
