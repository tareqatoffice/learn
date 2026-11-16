import { Profile } from "@/components/profile/Profile";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { getProfileData, parseTab } from "@/profile/data";
import { readTimeZone } from "@/speaking/timezone";

export const metadata = buildMetadata({
  title: "Profile",
  description: "Your progress and history across notes, interview questions, graphs, speaking and IELTS.",
  path: "/profile",
});

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await requireUser();
  await connectDb();
  const { tab: rawTab } = await searchParams;
  const tab = parseTab(typeof rawTab === "string" ? rawTab : undefined);
  const timeZone = await readTimeZone();
  const d = await getProfileData(user.userId, { name: user.name, image: user.image }, timeZone);

  return <Profile d={d} tab={tab} timeZone={timeZone} />;
}
