import Link from "next/link";
import { notFound } from "next/navigation";
import { TestReview } from "@/components/ielts/TestReview";
import { TestRunner } from "@/components/ielts/TestRunner";
import { getAttempt } from "@/ielts/practice/attempts";
import { requireUser } from "@/lib/authz";
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

  // Neither the answer key nor any audio link is in the run view: audio is signed when Play is pressed.
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
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
