import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeriesAdmin, listSubjects } from "@/features/admin/queries";
import { AdminCard, AdminList, AdminListItem, AdminPage, AdminSection } from "@/features/admin/components/layout";
import { RowActions } from "@/features/admin/components/RowActions";
import { SeriesForm } from "@/features/admin/components/SeriesForm";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";

export default async function AdminSeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([getSeriesAdmin(seriesId), listSubjects()]);
  if (!data) notFound();

  return (
    <AdminPage title={data.series.title} back={{ href: "/admin/notes", label: "Note series" }}>
      <AdminCard>
        <SeriesForm series={data.series} subjects={subjects} />
      </AdminCard>

      <AdminSection
        title={`Chapters (${data.notes.length})`}
        actions={
          <Link href={`/admin/notes/${seriesId}/chapters/new`} className={buttonVariants({ size: "sm" })}>
            New chapter
          </Link>
        }
      >
        <AdminList empty="No chapters yet.">
          {data.notes.map((n) => (
            <AdminListItem key={n.id} actions={<RowActions kind="note" id={n.id} status={n.status} label={n.title} />}>
              <Link
                href={`/admin/notes/${seriesId}/chapters/${n.id}`}
                className="inline-block text-sm font-medium hover:underline pointer-coarse:py-2.5"
              >
                {n.title}
              </Link>
            </AdminListItem>
          ))}
        </AdminList>
      </AdminSection>
    </AdminPage>
  );
}
