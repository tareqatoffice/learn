import Link from "next/link";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { type TodayTask, TodayTasks } from "@/components/speaking/TodayTasks";
import { WeekStrip } from "@/components/speaking/WeekStrip";
import { pageTitleClass } from "@/lib/ui";
import { lessonHasPart } from "@/speaking/lessons";
import { TASKS } from "@/speaking/tasks";

type Today = Awaited<ReturnType<typeof import("@/speaking/progress").getToday>>;
type LessonListItem = { id: string; title: string };

const linkClass =
  "rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function SpeakingHome({
  today,
  lessons,
  timeZone,
}: {
  today: Today;
  lessons: LessonListItem[];
  timeZone: string;
}) {
  const tasks: TodayTask[] = TASKS.filter((t) => today.settings.enabled[t]).map((task) => ({
    task,
    minutes: today.minutes[task] ?? 0,
    target: today.settings.targets[task],
    done: today.done[task],
    missing:
      today.lesson && lessonHasPart(today.lesson, task)
        ? null
        : task === "shadowing"
          ? "shadowing"
          : "generate",
  }));

  return (
    <div className="grid w-full gap-4">
      <TimeZoneCookie current={timeZone} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>Speaking practice</h1>
        <div className="flex gap-2">
          <Link href="/speaking/history" className={linkClass}>
            History
          </Link>
          <Link href="/speaking/settings" className={linkClass}>
            Settings
          </Link>
        </div>
      </div>

      {!today.storage && (
        <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Recording storage isn&apos;t set up yet, so takes can&apos;t be saved. Ask the site admin to add the R2 storage
          settings.
        </p>
      )}

      <section aria-labelledby="week" className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="week" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            This week
          </h2>
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{days(today.streak)}</span>{" "}
            <span className="text-muted-foreground">streak · best</span>{" "}
            <span className="font-semibold tabular-nums">{days(today.best)}</span>
          </p>
        </div>
        <WeekStrip week={today.week} today={today.date} />
      </section>

      <TodayTasks
        tasks={tasks}
        lesson={today.lesson ? { id: today.lesson.id, title: today.lesson.title } : null}
        lessons={lessons}
      />
    </div>
  );
}
