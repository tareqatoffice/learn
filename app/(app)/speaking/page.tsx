import { SpeakingHome } from "@/features/speaking/components/SpeakingHome";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { listPublishedLessons } from "@/features/speaking/lessons";
import { getToday } from "@/features/speaking/progress";
import { hasTimeZoneCookie, readTimeZone } from "@/features/speaking/timezone";

export const metadata = buildMetadata({
  title: "Speaking practice",
  description: "Today's shadowing, read-aloud and record-and-review practice, with your week and streak.",
  path: "/speaking",
});

export default async function SpeakingPage() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const [today, lessons] = await Promise.all([
    getToday(user.userId, timeZone, new Date(), { assignLesson: await hasTimeZoneCookie() }),
    listPublishedLessons(),
  ]);

  return (
    <SpeakingHome
      today={today}
      lessons={lessons.map((l) => ({ id: l.id, title: l.title }))}
      timeZone={timeZone}
    />
  );
}
