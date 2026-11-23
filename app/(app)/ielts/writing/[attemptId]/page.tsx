import { notFound } from "next/navigation";
import { WritingReview } from "@/features/ielts/components/WritingReview";
import { WritingRunner } from "@/features/ielts/components/WritingRunner";
import { getWritingAttempt } from "@/features/ielts/writing/attempts";
import { requireUser } from "@/features/auth/lib/authz";
import { presignGet, storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";

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
    <div className="grid w-full gap-6">
      <div className="grid gap-3">
        <BackLink href="/ielts/writing">← Writing</BackLink>
        <PageHeader title={view.kind === "full" ? "Writing full test" : view.kind === "task1" ? "Writing Task 1" : "Writing Task 2"} track="ielts" />
      </div>
      {view.status === "in_progress" ? <WritingRunner view={view} imageUrls={imageUrls} /> : <WritingReview view={view} imageUrls={imageUrls} />}
    </div>
  );
}
