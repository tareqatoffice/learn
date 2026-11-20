import { SpeakingHistory } from "@/features/speaking/components/SpeakingHistory";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { getTrends } from "@/features/speaking/progress";
import { listTakes } from "@/features/speaking/takes";
import { taskFromSlug } from "@/features/speaking/tasks";
import { readTimeZone } from "@/features/speaking/timezone";

export const metadata = buildMetadata({
  title: "Speaking history",
  description: "Every speaking take, newest first, with minutes practised and your scores over 30 days.",
  path: "/speaking/history",
});

const LIMIT = 100;

export default async function SpeakingHistoryPage({ searchParams }: PageProps<"/speaking/history">) {
  const { task: slug, before: rawBefore } = await searchParams;
  const task = typeof slug === "string" ? taskFromSlug(slug) : null;
  const before = typeof rawBefore === "string" ? rawBefore : undefined;
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const [takes, trends] = await Promise.all([
    listTakes(user.userId, { task: task ?? undefined, limit: LIMIT, before }),
    getTrends(user.userId, 30, timeZone),
  ]);

  return <SpeakingHistory takes={takes} trends={trends} task={task} before={before} timeZone={timeZone} />;
}
