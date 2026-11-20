import { FILTERS, IeltsHistory, type Filter } from "@/features/ielts/components/IeltsHistory";
import { bandSeries, criteriaSeries, weeklyMinutes } from "@/features/ielts/history";
import { getProfile } from "@/features/ielts/profile";
import { listTestAttempts } from "@/features/ielts/practice/attempts";
import { listAttempts } from "@/features/ielts/speaking/attempts";
import { listWritingAttempts } from "@/features/ielts/writing/attempts";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { readTimeZone } from "@/features/speaking/timezone";

export const metadata = buildMetadata({
  title: "IELTS history",
  description: "Your IELTS bands over time, Speaking mock criteria, weekly minutes and past Speaking attempts.",
  path: "/ielts/history",
});

const LIMIT = 50;

export default async function IeltsHistoryPage({ searchParams }: PageProps<"/ielts/history">) {
  const { show } = await searchParams;
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const filter: Filter = FILTERS.find((f) => f.key === show)?.key ?? "all";

  const [profile, bands, criteria, weeks, attempts, tests, writings] = await Promise.all([
    getProfile(user.userId),
    bandSeries(user.userId),
    criteriaSeries(user.userId),
    weeklyMinutes(user.userId, timeZone),
    listAttempts(user.userId, { limit: LIMIT }),
    listTestAttempts(user.userId, { limit: LIMIT }),
    listWritingAttempts(user.userId, LIMIT),
  ]);

  return (
    <IeltsHistory
      filter={filter}
      bands={bands}
      criteria={criteria}
      weeks={weeks}
      attempts={attempts}
      tests={tests}
      writings={writings}
      profile={profile}
    />
  );
}
