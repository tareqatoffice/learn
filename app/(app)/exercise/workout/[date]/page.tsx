import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/features/auth/lib/authz";
import { WorkoutPlayer } from "@/features/exercise/components/WorkoutPlayer";
import { WorkoutSummary } from "@/features/exercise/components/WorkoutSummary";
import { formatTarget } from "@/features/exercise/lib/format";
import { workoutPageMode } from "@/features/exercise/lib/pageMode";
import { exerciseById } from "@/features/exercise/library";
import { getSession, resumePoint, startSession } from "@/features/exercise/sessions";
import { dayPlan } from "@/features/exercise/weeks";
import { localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  return buildMetadata({
    title: "Workout",
    description: "Your guided workout for the day.",
    path: `/exercise/workout/${date}`,
  });
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <PageHeader title={title} track="exercise" />
      <p className="text-muted-foreground">{children}</p>
      <div>
        <Link href="/exercise" className={buttonVariants({ variant: "outline" })}>
          Back to Exercise
        </Link>
      </div>
    </div>
  );
}

export default async function WorkoutPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE.test(date)) notFound();
  const user = await requireUser();
  await connectDb();
  const today = localDate(new Date(), await readTimeZone());
  const [plan, existing] = await Promise.all([dayPlan(user.userId, date), getSession(user.userId, date)]);
  const mode = workoutPageMode(date, today, plan, existing);

  if (!plan || mode === "none") return <Notice title="Workout">No workout planned for this day.</Notice>;
  if (mode === "missed") return <Notice title="Missed">This workout was not done, and missed workouts are not made up.</Notice>;

  const title = `${plan.focus.charAt(0).toUpperCase()}${plan.focus.slice(1)} · ${plan.minutes} min`;

  if (mode === "summary") {
    const feels = Object.fromEntries((existing?.items ?? []).flatMap((i) => (i.feel ? [[i.exerciseId, i.feel]] : [])));
    return (
      <div className="mx-auto grid w-full max-w-md gap-5">
        <PageHeader title={title} track="exercise" />
        <WorkoutSummary plan={plan} feels={feels} />
      </div>
    );
  }

  if (mode === "preview") {
    return (
      <div className="mx-auto grid w-full max-w-md gap-5">
        <PageHeader title={title} description={`Planned for ${date}. It opens on the day.`} track="exercise" />
        <ol className="grid gap-2">
          {plan.items.map((item) => (
            <li key={item.exerciseId} className="rounded-xl border border-border bg-card p-3 text-sm">
              <span className="font-medium">{exerciseById(item.exerciseId)?.name ?? item.exerciseId}</span>
              <span className="text-muted-foreground">
                {" "}
                · {item.sets} × {formatTarget(item)}
              </span>
            </li>
          ))}
        </ol>
        <div>
          <Link href="/exercise" className={buttonVariants({ variant: "outline" })}>
            Back to Exercise
          </Link>
        </div>
      </div>
    );
  }

  const session = await startSession(user.userId, date);
  if (!session) return <Notice title="Workout">No workout planned for this day.</Notice>;
  const at = resumePoint(session, plan) ?? { item: plan.items.length, set: 0 };
  return (
    <div className="mx-auto w-full max-w-md">
      <WorkoutPlayer date={date} plan={plan} start={{ ...at, items: session.items }} />
    </div>
  );
}
