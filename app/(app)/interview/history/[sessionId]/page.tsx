import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizSession } from "@/features/interview/components/QuizSession";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { getAttemptLogs } from "@/features/progress/attempts";

export async function generateMetadata({ params }: PageProps<"/interview/history/[sessionId]">): Promise<Metadata> {
  const { sessionId } = await params;
  return buildMetadata({
    title: "Quiz answers",
    description: "Your answers to one quiz, with the reference answers and coach feedback.",
    path: `/interview/history/${encodeURIComponent(sessionId)}`,
  });
}

export default async function SessionHistoryPage({ params }: PageProps<"/interview/history/[sessionId]">) {
  const { sessionId } = await params;
  const user = await requireUser();
  await connectDb();
  const [log] = await getAttemptLogs(user.userId, sessionId);
  if (!log) notFound();

  return <QuizSession log={log} />;
}
