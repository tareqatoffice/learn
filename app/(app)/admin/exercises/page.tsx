import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { listExercisesAdmin } from "@/features/admin/exercises";
import { AdminList, AdminListItem, AdminPage } from "@/features/admin/components/layout";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Exercises · Admin",
  description: "Manage the exercise library: moves, cues and photos.",
  path: "/admin/exercises",
});

const DIFFICULTY = { 1: "easy", 2: "normal", 3: "hard" } as const;

export default async function AdminExercisesPage() {
  const exercises = await listExercisesAdmin();
  return (
    <AdminPage
      title="Exercises"
      description="The moves workout plans pick from. Changes are live as soon as you save."
      actions={
        <Link href="/admin/exercises/new" className={buttonVariants({ size: "sm" })}>
          New exercise
        </Link>
      }
    >
      <AdminList empty="No exercises yet. Run npm run seed:exercises to load the starter library.">
        {exercises.map((e) => (
          <AdminListItem key={e.id}>
            <Link href={`/admin/exercises/${e.id}`} className="font-medium hover:underline">
              {e.name}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">
              {e.focus.join(", ")} · {e.type} · {DIFFICULTY[e.difficulty]} · {e.mode}
              {e.startPhotoUrl || e.endPhotoUrl ? "" : " · no photo"}
              {e.archived ? " · archived" : ""}
            </span>
          </AdminListItem>
        ))}
      </AdminList>
    </AdminPage>
  );
}
