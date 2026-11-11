"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { swapLessonAction } from "@/app/(app)/speaking/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { TASK_LABEL, TASK_SLUG, type TaskKey } from "@/speaking/tasks";
import { mins } from "./format";

export type TodayTask = {
  task: TaskKey;
  minutes: number;
  target: number;
  done: boolean;
  /** Why today's lesson can't serve this task; null when it can. */
  missing: "shadowing" | "generate" | null;
};

const linkClass = "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Today's enabled tasks with their minutes against target, and today's lesson with "Change lesson". */
export function TodayTasks({
  tasks,
  lesson,
  lessons,
}: {
  tasks: TodayTask[];
  lesson: { id: string; title: string } | null;
  lessons: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(lesson?.id ?? "");
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function swap() {
    setError("");
    startTransition(async () => {
      try {
        const res = await swapLessonAction(choice);
        if (!res.ok) return setError(firstError(res.errors) ?? "Couldn't change the lesson. Try again.");
        setChanging(false);
        router.refresh();
      } catch {
        setError("Couldn't change the lesson. Try again.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <section aria-labelledby="todays-lesson" className="grid gap-2 rounded-xl border border-border bg-card p-5">
        <h2 id="todays-lesson" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today&apos;s lesson
        </h2>
        {lesson ? (
          <p className="text-lg font-semibold">{lesson.title}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {lessons.length
              ? "You've practised every lesson. Pick one again, or let the AI coach write new material."
              : "No lessons are published yet. The AI coach can write practice material for you."}
          </p>
        )}
        {lessons.length > 0 &&
          (changing ? (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="lesson-choice" className="sr-only">
                Lesson
              </label>
              <select
                id="lesson-choice"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="min-w-0 max-w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              >
                {!choice && <option value="">Choose a lesson</option>}
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={swap} disabled={pending || !choice || choice === lesson?.id}>
                {pending ? "Changing…" : "Use this lesson"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setChanging(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setChanging(true)}>
              Change lesson
            </Button>
          ))}
        {error && <Notice>{error}</Notice>}
      </section>

      <section aria-labelledby="todays-tasks" className="rounded-xl border border-border bg-card p-5">
        <h2 id="todays-tasks" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today&apos;s tasks
        </h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Every task is turned off.{" "}
            <Link href="/speaking/settings" className={`underline ${linkClass}`}>
              Turn one on
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {tasks.map((t) => (
              <li key={t.task} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3">
                <Link href={`/speaking/${TASK_SLUG[t.task]}`} className={`flex items-center gap-2 font-medium pointer-coarse:py-1 ${linkClass}`}>
                  {t.done && <Check aria-hidden className="size-4 text-ok" />}
                  {TASK_LABEL[t.task]}
                  {t.done && <span className="sr-only">(done)</span>}
                </Link>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {mins(t.minutes)} / {t.target} min
                </span>
                <ProgressBar value={t.minutes} max={t.target} className="col-span-2" />
                {t.missing === "shadowing" && (
                  <p className="col-span-2 text-xs text-muted-foreground">Today&apos;s lesson has no shadowing audio.</p>
                )}
                {t.missing === "generate" && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    No material in today&apos;s lesson.{" "}
                    <Link href={`/speaking/${TASK_SLUG[t.task]}`} className={`underline ${linkClass}`}>
                      Generate with AI
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
