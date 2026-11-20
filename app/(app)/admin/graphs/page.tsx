import Link from "next/link";
import { listGraphsAdmin } from "@/features/admin/queries";
import { AdminList, AdminListItem, AdminPage } from "@/features/admin/components/layout";
import { RowActions } from "@/features/admin/components/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Graphs · Admin",
  description: "Manage prerequisite topic graphs.",
  path: "/admin/graphs",
});

export default async function AdminGraphsPage() {
  await connectDb();
  const graphs = await listGraphsAdmin();
  return (
    <AdminPage
      title="Graphs"
      actions={
        <Link href="/admin/graphs/new" className={buttonVariants({ size: "sm" })}>
          New graph
        </Link>
      }
    >
      <AdminList empty="No graphs yet.">
        {graphs.map((item) => (
          <AdminListItem
            key={item.id}
            actions={<RowActions kind="graph" id={item.id} status={item.status} label={item.title} />}
          >
            <Link href={`/admin/graphs/${item.id}`} className="font-medium hover:underline">
              {item.title}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">{item.slug} · {item.topics} topics</span>
          </AdminListItem>
        ))}
      </AdminList>
    </AdminPage>
  );
}
