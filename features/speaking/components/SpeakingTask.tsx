import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { mins } from "@/features/speaking/components/format";
import { type Material, TaskRecorder } from "@/features/speaking/components/TaskRecorder";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import type { TaskKey } from "@/features/speaking/tasks";
import { TASK_LABEL, TASK_SLUG } from "@/features/speaking/tasks";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

const HINT = {
  shadowing: "Practise the clip, then record a take: speak along with it as it plays. One pass of the clip is one take.",
  readAloud: "Read the passage aloud at a steady pace. One reading is one take.",
  recordReview: "Answer the prompt as if someone asked you. One answer is one take.",
} as const;

export function SpeakingTask({
  task,
  timeZone,
  date,
  minutes,
  target,
  done,
  lessonId,
  hasLesson,
  material,
  sourceAudioUrl,
  clipSec,
  clipMarks,
  videoDefault,
  storage,
  aiOn,
}: {
  task: TaskKey;
  timeZone: string;
  date: string;
  minutes: number;
  target: number;
  done: boolean;
  lessonId: string | null;
  hasLesson: boolean;
  material: Material | null;
  sourceAudioUrl?: string;
  clipSec?: number;
  clipMarks?: number[];
  videoDefault: boolean;
  storage: boolean;
  aiOn: boolean;
}) {
  return (
    <div className="grid w-full gap-6">
      <TimeZoneCookie current={timeZone} />
      <div className="grid gap-3">
        <BackLink href="/speaking">← Speaking practice</BackLink>
        <PageHeader title={TASK_LABEL[task]} track="speaking" description={HINT[task]} />
      </div>

      <div className="grid gap-1.5">
        <p className="text-sm">
          <span className="tabular-nums">
            {mins(minutes)} / {target} min
          </span>{" "}
          <span className="text-muted-foreground">today{done ? " · done" : ""}</span>
        </p>
        <ProgressBar value={minutes} max={target} />
      </div>

      {task === "shadowing" && (!lessonId || !sourceAudioUrl) ? (
        <EmptyState>
          {lessonId
            ? "Recording storage isn't set up yet, so the lesson clip can't be played."
            : "Today's lesson has no shadowing audio."}{" "}
          <Link href="/speaking" className="underline">
            Change lesson
          </Link>{" "}
          or try another task.
        </EmptyState>
      ) : (
        <TaskRecorder
          key={`${TASK_SLUG[task]}-${lessonId ?? "none"}`}
          task={task}
          date={date}
          lessonId={lessonId}
          material={material}
          sourceAudioUrl={sourceAudioUrl}
          clipSec={clipSec}
          clipMarks={clipMarks}
          videoDefault={videoDefault}
          storage={storage}
          aiOn={aiOn}
          hasLesson={hasLesson}
        />
      )}
    </div>
  );
}
