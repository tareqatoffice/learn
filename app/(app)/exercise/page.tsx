import { ExerciseHome } from "@/features/exercise/components/ExerciseHome";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Exercise",
  description: "Your weight goal, this week's workouts and weight log.",
  path: "/exercise",
});

export default async function ExercisePage() {
  return <ExerciseHome />;
}
