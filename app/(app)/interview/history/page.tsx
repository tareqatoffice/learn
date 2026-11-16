import { QuizHistory } from "@/components/interview/QuizHistory";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { listAttemptSessions } from "@/progress/attempts";
import { readTimeZone } from "@/speaking/timezone";

export const metadata = buildMetadata({
  title: "Quiz answers",
  description: "Every quiz you have taken, with your written and voice answers, ready to download for review.",
  path: "/interview/history",
});

export default async function HistoryPage() {
  const user = await requireUser();
  await connectDb();
  const [sessions, timeZone] = await Promise.all([listAttemptSessions(user.userId), readTimeZone()]);

  return <QuizHistory sessions={sessions} timeZone={timeZone} />;
}
