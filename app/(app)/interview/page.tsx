import { InterviewHome } from "@/components/interview/InterviewHome";
import { listBooksWithProgress } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { listUnfinished } from "@/progress/quiz";
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
