import Link from "next/link";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { type TodayTask, TodayTasks } from "@/components/speaking/TodayTasks";
import { WeekStrip } from "@/components/speaking/WeekStrip";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { lessonHasPart, listPublishedLessons } from "@/speaking/lessons";
import { getToday } from "@/speaking/progress";
import { TASKS } from "@/speaking/tasks";
import { readTimeZone } from "@/speaking/timezone";

export const metadata = buildMetadata({
  title: "Speaking practice",
  description: "Today's shadowing, read-aloud and record-and-review practice, with your week and streak.",
  path: "/speaking",
});

const linkClass =
  "rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export default async function SpeakingPage() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const [today, lessons] = await Promise.all([getToday(user.userId, timeZone), listPublishedLessons()]);

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
    <div className="mx-auto grid w-full max-w-3xl gap-4">
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
        lessons={lessons.map((l) => ({ id: l.id, title: l.title }))}
      />
    </div>
  );
}
