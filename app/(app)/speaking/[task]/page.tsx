import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { mins } from "@/components/speaking/format";
import { type Material, TaskRecorder } from "@/components/speaking/TaskRecorder";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { presignGet } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { lessonHasPart } from "@/speaking/lessons";
import { getToday } from "@/speaking/progress";
import { TASK_LABEL, TASK_SLUG, taskFromSlug } from "@/speaking/tasks";
import { readTimeZone } from "@/speaking/timezone";

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
  const today = await getToday(user.userId, timeZone);
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

  const minutes = today.minutes[task] ?? 0;
  const target = today.settings.targets[task];

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <TimeZoneCookie current={timeZone} />
      <div>
        <Link href="/speaking" className="text-sm text-muted-foreground hover:underline">
          ← Speaking practice
        </Link>
        <h1 className={pageTitleClass}>{TASK_LABEL[task]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{HINT[task]}</p>
      </div>

      <div className="grid gap-1.5">
        <p className="text-sm">
          <span className="tabular-nums">
            {mins(minutes)} / {target} min
          </span>{" "}
          <span className="text-muted-foreground">today{today.done[task] ? " · done" : ""}</span>
        </p>
        <ProgressBar value={minutes} max={target} />
      </div>

      {task === "shadowing" && (!lesson || !sourceAudioUrl) ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {lesson
            ? "Recording storage isn't set up yet, so the lesson clip can't be played."
            : "Today's lesson has no shadowing audio."}{" "}
          <Link href="/speaking" className="underline">
            Change lesson
          </Link>{" "}
          or try another task.
        </p>
      ) : (
        <TaskRecorder
          key={`${TASK_SLUG[task]}-${lesson?.id ?? "none"}`}
          task={task}
          date={today.date}
          lessonId={lesson?.id ?? null}
          material={material}
          sourceAudioUrl={sourceAudioUrl}
          clipSec={task === "shadowing" ? lesson?.shadow?.durationSec : undefined}
          videoDefault={today.settings.video[task]}
          storage={today.storage}
        />
      )}
    </div>
  );
}
