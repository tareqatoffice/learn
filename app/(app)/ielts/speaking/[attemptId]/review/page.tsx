import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttemptReview } from "@/components/ielts/AttemptReview";
import { getAttempt } from "@/ielts/speaking/attempts";
import { getAiConfig } from "@/lib/aiSettings";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { getEffectiveSettings } from "@/speaking/settings";

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
    <Link href="/ielts/speaking" className="text-sm text-muted-foreground hover:underline">
      ← Speaking practice
    </Link>
  );
  if (!storageConfigured()) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        {back}
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Recording storage isn&apos;t set up yet, so recordings can&apos;t be played.
        </p>
      </div>
    );
  }

  const attempt = await getAttempt(user.userId, attemptId);
  if (!attempt) notFound();
  // Only whether the coach is on reaches the page; the key never does.
  const [ai, settings] = await Promise.all([getAiConfig(), getEffectiveSettings(user.userId)]);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      {back}
      <AttemptReview attempt={attempt} aiOn={ai.settings.active} bodyConsent={settings.bodyConsent} />
    </div>
  );
}
