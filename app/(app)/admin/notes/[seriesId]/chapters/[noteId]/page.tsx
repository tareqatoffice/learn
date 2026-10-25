import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { getNoteAdmin, getSeriesAdmin, listSubjects } from "@/admin/queries";
import { NoteForm } from "@/components/admin/NoteForm";
import { connectDb } from "@/lib/db";

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ seriesId: string; noteId: string }>;
}) {
  const { seriesId, noteId } = await params;
  await connectDb();
  const [series, note, subjects] = await Promise.all([
    getSeriesAdmin(seriesId),
    getNoteAdmin(noteId),
    listSubjects(),
  ]);
  if (!series || !note || note.seriesId !== seriesId) notFound();
  return (
    <section className="grid gap-4">
      <BackLink href={`/admin/notes/${seriesId}`}>
        ← {series.series.title}
      </BackLink>
      <h1 className="text-2xl font-semibold">{note.title}</h1>
      <NoteForm note={note} subjects={subjects} />
    </section>
  );
}
