import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/features/auth/lib/authz";
import { weekStartOf } from "@/features/focus/habit";
import { getFocusReview } from "@/features/focus/review";
import { PlanForm, ReviewForm } from "@/features/focus/components/ReviewForms";
import { ReviewSummary } from "@/features/focus/components/ReviewSummary";
import { addDays, localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata = buildMetadata({
  title: "Weekly focus review",
  description: "Your focus time, streak and distractions this week, plus a three-question review and a daily plan.",
  path: "/focus/review",
});

const linkClass =
  "rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default async function FocusReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  await connectDb();
  const { week } = await searchParams;
  const today = localDate(new Date(), await readTimeZone());
  const previous = week === "prev";
  const weekStart = previous ? addDays(weekStartOf(today), -7) : weekStartOf(today);
  const d = await getFocusReview(user.userId, today, weekStart);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Weekly focus review"
        description={`Week of ${new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}${previous ? "" : ", so far"}. Small visible wins keep motivation up.`}
        actions={
          <>
            <Link href="/focus/review" aria-current={previous ? undefined : "page"} className={cn(linkClass, !previous && "bg-muted")}>
              This week
            </Link>
            <Link href="/focus/review?week=prev" aria-current={previous ? "page" : undefined} className={cn(linkClass, previous && "bg-muted")}>
              Last week
            </Link>
          </>
        }
      />
      <ReviewSummary d={d} />
      <section aria-labelledby="review-title" className="grid gap-4 rounded-lg border border-border bg-card p-4">
        <h2 id="review-title" className="text-lg font-semibold">
          Your review
        </h2>
        <ReviewForm key={weekStart} weekStart={weekStart} initial={d.answers} />
      </section>
      <section aria-labelledby="plan-title" className="grid gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-1">
          <h2 id="plan-title" className="text-lg font-semibold">
            Your if-then plan
          </h2>
          <p className="text-sm text-muted-foreground">
            A specific plan raises follow-through. Name the time and what you will do.
          </p>
        </div>
        <PlanForm initial={d.plan} suggestedMinutes={d.block.minutes} />
      </section>
    </div>
  );
}
