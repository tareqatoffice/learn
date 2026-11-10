import { notFound } from "next/navigation";
import { getLessonAdmin } from "@/admin/speaking";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { SpeakingLessonForm } from "@/components/admin/SpeakingLessonForm";
import { connectDb } from "@/lib/db";
import { storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { Subject } from "@/models";

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const lesson = lessonId === "new" ? null : await getLessonAdmin(lessonId);
  return buildMetadata({
    title: `${lesson?.title ?? "New lesson"} · Admin`,
    description: "Edit a speaking lesson: shadowing audio, read-aloud passage and speaking prompt.",
    path: `/admin/speaking/${lessonId}`,
  });
}

/** `/admin/speaking/new` creates a lesson; any other segment is a lesson id. */
export default async function AdminSpeakingLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  await connectDb();
  const isNew = lessonId === "new";
  const lesson = isNew ? undefined : await getLessonAdmin(lessonId);
  if (!isNew && !lesson) notFound();
  const subjects = (await Subject.find({}, { name: 1 }).sort({ order: 1, name: 1 }).lean<{ _id: unknown; name: string }[]>()).map((s) => ({
    slug: String(s._id),
    name: s.name,
  }));

  return (
    <AdminPage title={lesson?.title ?? "New lesson"} back={{ href: "/admin/speaking", label: "Speaking lessons" }} width="narrow">
      <AdminCard>
        <SpeakingLessonForm lesson={lesson ?? undefined} subjects={subjects} storageReady={storageConfigured()} />
      </AdminCard>
    </AdminPage>
  );
}
