import { notFound } from "next/navigation";
import { getNoteAdmin, getSeriesAdmin, listSubjects } from "@/features/admin/queries";
import { NoteForm } from "@/features/admin/components/NoteForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
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
    <AdminPage title={note.title} back={{ href: `/admin/notes/${seriesId}`, label: series.series.title }}>
      <AdminCard>
        <NoteForm note={note} subjects={subjects} />
      </AdminCard>
    </AdminPage>
  );
}
