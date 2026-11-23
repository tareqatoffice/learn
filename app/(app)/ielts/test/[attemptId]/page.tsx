import { notFound } from "next/navigation";
import { TestReview } from "@/features/ielts/components/TestReview";
import { TestRunner } from "@/features/ielts/components/TestRunner";
import { getAttempt } from "@/features/ielts/practice/attempts";
import { requireUser } from "@/features/auth/lib/authz";
import { buildMetadata } from "@/lib/seo";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";

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
    <div className="grid w-full gap-6">
      <div className="grid gap-3">
        <BackLink href={`/ielts/${got.view.skill}`}>← {got.view.skill === "listening" ? "Listening" : "Reading"}</BackLink>
        <PageHeader title={got.view.title} track="ielts" />
      </div>
      {got.state === "run" ? <TestRunner view={got.view} /> : <TestReview view={got.view} />}
    </div>
  );
}
