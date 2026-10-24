import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/QuizRunner";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { getSessionView } from "@/progress/quiz";

export const metadata = { title: "Quiz · Learn" };

export default async function QuizPage({ params }: PageProps<"/interview/quiz/[sessionId]">) {
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
