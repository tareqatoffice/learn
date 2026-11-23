import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttemptReview } from "@/features/ielts/components/AttemptReview";
import { getAttempt } from "@/features/ielts/speaking/attempts";
import { getAiConfig } from "@/features/ai/lib/aiSettings";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { getEffectiveSettings } from "@/features/speaking/settings";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";

export async function generateMetadata({ params }: PageProps<"/ielts/speaking/[attemptId]/review">): Promise<Metadata> {
  const { attemptId } = await params;
  return buildMetadata({
    title: "Review IELTS Speaking",
    description: "Play back an IELTS Speaking attempt, rate yourself, then see the AI estimate.",
    path: `/ielts/speaking/${encodeURIComponent(attemptId)}/review`,
  });
}

export default async function IeltsReviewPage({ params }: PageProps<"/ielts/speaking/[attemptId]/review">) {
  const { attemptId } = await params;
  const user = await requireUser();
  await connectDb();

  const back = (
    <BackLink href="/ielts/speaking">← Speaking practice</BackLink>
  );
  if (!storageConfigured()) {
    return (
      <div className="grid w-full gap-4">
        {back}
        <EmptyState>
          Recording storage isn&apos;t set up yet, so recordings can&apos;t be played.
        </EmptyState>
      </div>
    );
  }

  const attempt = await getAttempt(user.userId, attemptId);
  if (!attempt) notFound();
  const [ai, settings] = await Promise.all([getAiConfig(), getEffectiveSettings(user.userId)]);

  return (
    <div className="grid w-full gap-4">
      {back}
      <AttemptReview attempt={attempt} aiOn={ai.settings.active} bodyConsent={settings.bodyConsent} />
    </div>
  );
}
