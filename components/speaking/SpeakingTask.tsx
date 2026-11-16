import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { mins } from "@/components/speaking/format";
import { type Material, TaskRecorder } from "@/components/speaking/TaskRecorder";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { pageTitleClass } from "@/lib/ui";
import type { TaskKey } from "@/speaking/tasks";
import { TASK_LABEL, TASK_SLUG } from "@/speaking/tasks";

const HINT = {
  shadowing: "Play the clip and speak along with it. One pass of the clip is one take.",
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
  videoDefault: boolean;
  storage: boolean;
  aiOn: boolean;
}) {
  return (
    <div className="grid w-full gap-4">
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
          <span className="text-muted-foreground">today{done ? " · done" : ""}</span>
        </p>
        <ProgressBar value={minutes} max={target} />
      </div>

      {task === "shadowing" && (!lessonId || !sourceAudioUrl) ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {lessonId
            ? "Recording storage isn't set up yet, so the lesson clip can't be played."
            : "Today's lesson has no shadowing audio."}{" "}
          <Link href="/speaking" className="underline">
            Change lesson
          </Link>{" "}
          or try another task.
        </p>
      ) : (
        <TaskRecorder
          key={`${TASK_SLUG[task]}-${lessonId ?? "none"}`}
          task={task}
          date={date}
          lessonId={lessonId}
          material={material}
          sourceAudioUrl={sourceAudioUrl}
          clipSec={clipSec}
          videoDefault={videoDefault}
          storage={storage}
          aiOn={aiOn}
          hasLesson={hasLesson}
        />
      )}
    </div>
  );
}
