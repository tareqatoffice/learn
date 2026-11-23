import { requireUser } from "@/features/auth/lib/authz";
import { ExerciseSetup } from "@/features/exercise/components/ExerciseSetup";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Exercise goal",
  description: "Set your weight goal, workout days and session length.",
  path: "/exercise/setup",
});

export default async function ExerciseSetupPage() {
  const user = await requireUser();
  await connectDb();
  return <ExerciseSetup userId={user.userId} />;
}
