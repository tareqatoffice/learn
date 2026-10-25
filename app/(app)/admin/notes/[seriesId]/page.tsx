import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { getSeriesAdmin, listSubjects } from "@/admin/queries";
import { RowActions } from "@/components/admin/RowActions";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";

export default async function AdminSeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([getSeriesAdmin(seriesId), listSubjects()]);
  if (!data) notFound();

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <BackLink href="/admin/notes">
          ← Note series
        </BackLink>
        <h1 className="text-2xl font-semibold">{data.series.title}</h1>
        <SeriesForm series={data.series} subjects={subjects} />
      </section>
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Chapters ({data.notes.length})</h2>
          <Link href={`/admin/notes/${seriesId}/chapters/new`} className={buttonVariants({ size: "sm" })}>
            New chapter
          </Link>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.notes.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
              <Link href={`/admin/notes/${seriesId}/chapters/${n.id}`} className="inline-block text-sm font-medium hover:underline pointer-coarse:py-2.5">
                {n.title}
              </Link>
              <RowActions kind="note" id={n.id} status={n.status} label={n.title} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
