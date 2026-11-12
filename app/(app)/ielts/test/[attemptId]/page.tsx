import Link from "next/link";
import { notFound } from "next/navigation";
import { TestReview } from "@/components/ielts/TestReview";
import { TestRunner } from "@/components/ielts/TestRunner";
import { getAttempt } from "@/ielts/practice/attempts";
import { requireUser } from "@/lib/authz";
import { presignGet, storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";

export const metadata = buildMetadata({
  title: "IELTS practice test",
  description: "Answer an IELTS Listening or Reading test, or review the marked result.",
  path: "/ielts/test",
});

export default async function IeltsTestPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await requireUser();
  const got = await getAttempt(user.userId, attemptId);
  if (!got) notFound();

  // Audio links are signed per request; the answer key never reaches the run view.
  const audioUrls =
    got.state === "run" && got.view.skill === "listening" && storageConfigured()
      ? await Promise.all(got.view.audioKeys.map((k) => (k ? presignGet(k) : Promise.resolve(""))))
      : [];

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
      {got.state === "run" ? <TestRunner view={got.view} audioUrls={audioUrls} /> : <TestReview view={got.view} />}
    </div>
  );
}
