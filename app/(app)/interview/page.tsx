import { InterviewHome } from "@/features/interview/components/InterviewHome";
import { listBooksWithProgress } from "@/features/content/queries";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { listUnfinished } from "@/features/progress/quiz";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Interview prep",
  description: "Question books with spaced review and quick quizzes.",
  path: "/interview",
});

export default async function InterviewPage() {
  const user = await requireUser();
  await connectDb();
  const [books, unfinished] = await Promise.all([
    listBooksWithProgress(user.userId),
    listUnfinished(user.userId),
  ]);

  return <InterviewHome books={books} unfinished={unfinished} />;
}
