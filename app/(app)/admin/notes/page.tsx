import Link from "next/link";
import { listSeriesAdmin } from "@/features/admin/queries";
import { AdminList, AdminListItem, AdminPage } from "@/features/admin/components/layout";
import { RowActions } from "@/features/admin/components/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Note series · Admin",
  description: "Manage study note series and chapters.",
  path: "/admin/notes",
});

export default async function AdminNotesPage() {
  await connectDb();
  const series = await listSeriesAdmin();
  return (
    <AdminPage
      title="Note series"
      actions={
        <Link href="/admin/notes/new" className={buttonVariants({ size: "sm" })}>
          New series
        </Link>
      }
    >
      <AdminList empty="No series yet.">
        {series.map((item) => (
          <AdminListItem
            key={item.id}
            actions={<RowActions kind="series" id={item.id} status={item.status} label={item.title} />}
          >
            <Link href={`/admin/notes/${item.id}`} className="font-medium hover:underline">
              {item.title}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">{item.slug} · {item.chapters} chapters</span>
          </AdminListItem>
        ))}
      </AdminList>
    </AdminPage>
  );
}
