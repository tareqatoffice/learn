import { listSubjects } from "@/features/admin/queries";
import { SeriesForm } from "@/features/admin/components/SeriesForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";

export default async function NewSeriesPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <AdminPage title="New series" back={{ href: "/admin/notes", label: "Note series" }}>
      <AdminCard>
        <SeriesForm subjects={subjects} />
      </AdminCard>
    </AdminPage>
  );
}
