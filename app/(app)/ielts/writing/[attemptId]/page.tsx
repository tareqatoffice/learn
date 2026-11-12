import Link from "next/link";
import { notFound } from "next/navigation";
import { WritingReview } from "@/components/ielts/WritingReview";
import { WritingRunner } from "@/components/ielts/WritingRunner";
import { getWritingAttempt } from "@/ielts/writing/attempts";
import { requireUser } from "@/lib/authz";
import { presignGet, storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";

export async function generateMetadata({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return buildMetadata({
    title: "IELTS Writing attempt",
    description: "Write your answer, or review and rate a submitted one.",
    path: `/ielts/writing/${attemptId}`,
  });
}

export default async function IeltsWritingAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await requireUser();
  const view = await getWritingAttempt(user.userId, attemptId);
  if (!view) notFound();
  const imageUrls = storageConfigured() ? await Promise.all(view.tasks.map((t) => (t.imageKey ? presignGet(t.imageKey) : Promise.resolve("")))) : view.tasks.map(() => "");
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>{view.kind === "full" ? "Writing full test" : view.kind === "task1" ? "Writing Task 1" : "Writing Task 2"}</h1>
        <Link href="/ielts/writing" className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Back to Writing
        </Link>
      </div>
      {view.status === "in_progress" ? <WritingRunner view={view} imageUrls={imageUrls} /> : <WritingReview view={view} />}
    </div>
  );
}
