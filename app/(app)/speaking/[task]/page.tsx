import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type Material } from "@/features/speaking/components/TaskRecorder";
import { SpeakingTask } from "@/features/speaking/components/SpeakingTask";
import { getAiConfig } from "@/features/ai/lib/aiSettings";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { presignGet } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { lessonHasPart } from "@/features/speaking/lessons";
import { getToday } from "@/features/speaking/progress";
import { TASK_LABEL, taskFromSlug } from "@/features/speaking/tasks";
import { hasTimeZoneCookie, readTimeZone } from "@/features/speaking/timezone";

const HINT = {
  shadowing: "Play the clip and speak along with it. One pass of the clip is one take.",
  readAloud: "Read the passage aloud at a steady pace. One reading is one take.",
  recordReview: "Answer the prompt as if someone asked you. One answer is one take.",
} as const;

export async function generateMetadata({ params }: PageProps<"/speaking/[task]">): Promise<Metadata> {
  const { task: slug } = await params;
  const task = taskFromSlug(slug);
  return buildMetadata({
    title: task ? `${TASK_LABEL[task]} · Speaking` : "Speaking",
    description: task ? HINT[task] : "Speaking practice.",
    path: `/speaking/${encodeURIComponent(slug)}`,
  });
}

export default async function TaskPage({ params }: PageProps<"/speaking/[task]">) {
  const { task: slug } = await params;
  const task = taskFromSlug(slug);
  if (!task) notFound();
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const [today, ai] = await Promise.all([
    getToday(user.userId, timeZone, new Date(), { assignLesson: await hasTimeZoneCookie() }),
    getAiConfig(),
  ]);
  const lesson = today.lesson && lessonHasPart(today.lesson, task) ? today.lesson : null;

  let material: Material | null = null;
  let sourceAudioUrl: string | undefined;
  if (lesson) {
    if (task === "shadowing") {
      material = { title: lesson.title, text: lesson.shadow?.text, generated: false };
      const key = lesson.shadow?.audioKey;
      sourceAudioUrl = key ? (today.storage ? await presignGet(key) : undefined) : lesson.shadow?.audioUrl;
    } else if (task === "readAloud") {
      material = { title: lesson.title, text: lesson.passage, generated: false };
    } else {
      material = { title: lesson.title, prompt: lesson.prompt, generated: false };
    }
  }

  return (
    <SpeakingTask
      task={task}
      timeZone={timeZone}
      date={today.date}
      minutes={today.minutes[task] ?? 0}
      target={today.settings.targets[task]}
      done={today.done[task]}
      lessonId={lesson?.id ?? null}
      hasLesson={Boolean(today.lesson)}
      material={material}
      sourceAudioUrl={sourceAudioUrl}
      clipSec={task === "shadowing" ? lesson?.shadow?.durationSec : undefined}
      clipMarks={task === "shadowing" ? lesson?.shadow?.marks : undefined}
      videoDefault={today.settings.video[task]}
      storage={today.storage}
      aiOn={ai.settings.active}
    />
  );
}
