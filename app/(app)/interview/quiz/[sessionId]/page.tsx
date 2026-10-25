import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/QuizRunner";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { getSessionView } from "@/progress/quiz";

export async function generateMetadata({
  params,
}: PageProps<"/interview/quiz/[sessionId]">): Promise<Metadata> {
  const { sessionId } = await params;
  return buildMetadata({
    title: "Quiz",
    description: "A timed set of interview questions from your question books.",
    path: `/interview/quiz/${encodeURIComponent(sessionId)}`,
  });
}

export default async function QuizPage({
  params,
}: PageProps<"/interview/quiz/[sessionId]">) {
  const { sessionId } = await params;
  const user = await requireUser();
  await connectDb();
  const view = await getSessionView(user.userId, sessionId);
  if (!view) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <QuizRunner initial={view} />
    </div>
  );
}
