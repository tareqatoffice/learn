import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeriesAdmin, listSubjects } from "@/admin/queries";
import { NoteForm } from "@/components/admin/NoteForm";
import { connectDb } from "@/lib/db";

export default async function NewChapterPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([getSeriesAdmin(seriesId), listSubjects()]);
  if (!data) notFound();
  return (
    <section className="grid gap-4">
      <Link href={`/admin/notes/${seriesId}`} className="text-sm text-muted-foreground hover:underline">
        ← {data.series.title}
      </Link>
      <h1 className="text-2xl font-semibold">New chapter</h1>
      <NoteForm note={{ id: "", seriesId, slug: "", title: "", body: "", subjects: data.series.subjects, status: "draft" }} subjects={subjects} />
    </section>
  );
}
