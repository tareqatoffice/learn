import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { buttonVariants } from "@/components/ui/button";
import { trackVar } from "@/components/track";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { type TodayTask, TodayTasks } from "@/features/speaking/components/TodayTasks";
import { WeekStrip } from "@/features/speaking/components/WeekStrip";
import { lessonHasPart } from "@/features/speaking/lessons";
import { TASKS } from "@/features/speaking/tasks";

type Today = Awaited<ReturnType<typeof import("@/features/speaking/progress").getToday>>;
type LessonListItem = { id: string; title: string };

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
    <div className="grid w-full gap-6">
      <TimeZoneCookie current={timeZone} />
      <PageHeader
        title="Speaking practice"
        track="speaking"
        actions={
          <>
            <Link href="/speaking/history" className={buttonVariants({ variant: "outline", size: "sm" })}>
              History
            </Link>
            <Link href="/speaking/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Settings
            </Link>
          </>
        }
      />

      {!today.storage && (
        <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Recording storage isn&apos;t set up yet, so takes can&apos;t be saved. Ask the site admin to add the R2 storage
          settings.
        </p>
      )}

      <Panel
        title="This week"
        track="speaking"
        action={
          <p className="text-sm">
            <span className="text-lg font-semibold tabular-nums" style={{ color: trackVar("speaking") }}>
              {days(today.streak)}
            </span>{" "}
            <span className="text-muted-foreground">streak, best</span>{" "}
            <span className="font-semibold tabular-nums">{days(today.best)}</span>
          </p>
        }
        className="gap-4 p-5"
      >
        <WeekStrip week={today.week} today={today.date} />
      </Panel>

      <TodayTasks
        tasks={tasks}
        lesson={today.lesson ? { id: today.lesson.id, title: today.lesson.title } : null}
        lessons={lessons}
      />
    </div>
  );
}
