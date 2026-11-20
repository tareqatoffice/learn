import { Dashboard } from "@/features/dashboard/components/Dashboard";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { getDashboard } from "@/features/progress/dashboard";
import { getToday } from "@/features/speaking/progress";
import { hasTimeZoneCookie, readTimeZone } from "@/features/speaking/timezone";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Dashboard",
  description: "Your progress across interview books, topic graphs and notes.",
  path: "/dashboard",
});

export default async function DashboardPage() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const [dash, speaking] = await Promise.all([
    getDashboard(user.userId, timeZone),
    getToday(user.userId, timeZone, new Date(), { assignLesson: await hasTimeZoneCookie() }),
  ]);
  const firstName =
    user.name && user.name !== user.email ? user.name.split(" ")[0] : undefined;

  return <Dashboard dash={dash} speaking={speaking} firstName={firstName} timeZone={timeZone} />;
}
