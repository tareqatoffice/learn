import Link from "next/link";
import { listLessonsAdmin } from "@/admin/speaking";
import { AdminCard, AdminList, AdminListItem, AdminPage, AdminSection } from "@/components/admin/layout";
import { SpeakingDefaultsForm } from "@/components/admin/SpeakingDefaultsForm";
import { SpeakingLessonRowActions } from "@/components/admin/SpeakingLessonRowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { getDefaults } from "@/speaking/settings";

export const metadata = buildMetadata({
  title: "Speaking lessons · Admin",
  description: "Manage speaking lessons and the default daily targets.",
  path: "/admin/speaking",
});

export default async function AdminSpeakingPage() {
  await connectDb();
  const [lessons, defaults] = await Promise.all([listLessonsAdmin(), getDefaults()]);
  return (
    <AdminPage
      title="Speaking lessons"
      description="Each lesson can have shadowing audio, a read-aloud passage and a speaking prompt."
      actions={
        <Link href="/admin/speaking/new" className={buttonVariants({ size: "sm" })}>
          New lesson
        </Link>
      }
    >
      <AdminList empty="No lessons yet.">
        {lessons.map((lesson) => (
          <AdminListItem key={lesson.id} actions={<SpeakingLessonRowActions id={lesson.id} label={lesson.title} />}>
            <Link href={`/admin/speaking/${lesson.id}`} className="font-medium hover:underline">
              {lesson.title}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">
              {lesson.status} · {lesson.shadowAudioKey || lesson.shadowAudioUrl ? "audio" : "no audio"}
              {lesson.passage.trim() ? " · passage" : ""}
              {lesson.prompt.trim() ? " · prompt" : ""}
            </span>
          </AdminListItem>
        ))}
      </AdminList>

      <AdminSection title="Default daily targets">
        <AdminCard description="Minutes per day for each task. Learners can set their own.">
          <SpeakingDefaultsForm initial={defaults} />
        </AdminCard>
      </AdminSection>
    </AdminPage>
  );
}
