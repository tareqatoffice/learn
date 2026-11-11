import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  confirmPartAction,
  finishAttemptAction,
  startPartAction,
  transcribePartAction,
} from "@/app/(app)/ielts/speaking/actions";
import { MockRunner, type MockQuestions } from "@/components/ielts/MockRunner";
import { getProfile } from "@/ielts/profile";
import { getAttempt } from "@/ielts/speaking/attempts";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/ielts/speaking/[attemptId]">): Promise<Metadata> {
  const { attemptId } = await params;
  return buildMetadata({
    title: "IELTS Speaking practice",
    description: "Answer the questions and record your IELTS Speaking practice.",
    path: `/ielts/speaking/${encodeURIComponent(attemptId)}`,
  });
}

const actions = {
  startPart: startPartAction,
  confirmPart: confirmPartAction,
  transcribePart: transcribePartAction,
  finishAttempt: finishAttemptAction,
};

export default async function IeltsRunPage({ params }: PageProps<"/ielts/speaking/[attemptId]">) {
  const { attemptId } = await params;
  const user = await requireUser();
  await connectDb();

  if (!storageConfigured()) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <Link href="/ielts/speaking" className="text-sm text-muted-foreground hover:underline">
          ← Speaking practice
        </Link>
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Recording storage isn&apos;t set up yet, so practice can&apos;t be recorded.
        </p>
      </div>
    );
  }

  const [attempt, profile] = await Promise.all([getAttempt(user.userId, attemptId), getProfile(user.userId)]);
  if (!attempt) notFound();
  // A finished attempt, or one with recordings already stored, is reviewed rather than run again.
  if (attempt.status !== "inProgress" || attempt.parts.some((p) => p.stored)) redirect(`/ielts/speaking/${attemptId}/review`);

  // With no profile: mock video on, drill video off, examiner voice on.
  const video = attempt.kind === "mock" ? (profile?.mockVideo ?? true) : (profile?.drillVideo ?? false);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <MockRunner
        attemptId={attempt.id}
        kind={attempt.kind}
        questions={attempt.questions as MockQuestions}
        video={video}
        examinerVoice={profile?.examinerVoice ?? true}
        actions={actions}
      />
    </div>
  );
}
