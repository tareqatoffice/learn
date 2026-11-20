import Link from "next/link";
import { notFound } from "next/navigation";
import { TestReview } from "@/features/ielts/components/TestReview";
import { TestRunner } from "@/features/ielts/components/TestRunner";
import { getAttempt } from "@/features/ielts/practice/attempts";
import { requireUser } from "@/features/auth/lib/authz";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";

export async function generateMetadata({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return buildMetadata({
    title: "IELTS practice test",
    description: "Answer an IELTS Listening or Reading test, or review the marked result.",
    path: `/ielts/test/${attemptId}`,
  });
}

export default async function IeltsTestPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await requireUser();
  const got = await getAttempt(user.userId, attemptId);
  if (!got) notFound();

  return (
    <div className="grid w-full gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>{got.view.title}</h1>
        <Link
          href={`/ielts/${got.view.skill}`}
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to {got.view.skill}
        </Link>
      </div>
      {got.state === "run" ? <TestRunner view={got.view} /> : <TestReview view={got.view} />}
    </div>
  );
}
