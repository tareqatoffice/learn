import { notFound } from "next/navigation";
import { exerciseInUse, getExerciseAdmin, nextExerciseOrder } from "@/features/admin/exercises";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { ExerciseForm } from "@/features/admin/components/ExerciseForm";
import { storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";

type Params = { params: Promise<{ exerciseId: string }> };

export async function generateMetadata({ params }: Params) {
  const { exerciseId } = await params;
  const exercise = exerciseId === "new" ? null : await getExerciseAdmin(exerciseId);
  return buildMetadata({
    title: `${exercise?.name ?? "New exercise"} · Admin`,
    description: "Edit an exercise: focus, type, difficulty, cues and photos.",
    path: `/admin/exercises/${exerciseId}`,
  });
}

export default async function AdminExercisePage({ params }: Params) {
  const { exerciseId } = await params;
  const isNew = exerciseId === "new";
  const exercise = isNew ? null : await getExerciseAdmin(exerciseId);
  if (!isNew && !exercise) notFound();
  const [order, inUse] = await Promise.all([isNew ? nextExerciseOrder() : 0, isNew ? false : exerciseInUse(exerciseId)]);

  return (
    <AdminPage title={exercise?.name ?? "New exercise"} back={{ href: "/admin/exercises", label: "Exercises" }} width="narrow">
      <AdminCard>
        <ExerciseForm exercise={exercise ?? undefined} defaultOrder={order} inUse={inUse} storageReady={storageConfigured()} />
      </AdminCard>
    </AdminPage>
  );
}
