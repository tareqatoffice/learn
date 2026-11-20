import { listSubjects } from "@/features/admin/queries";
import { GraphForm } from "@/features/admin/components/GraphForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";

export default async function NewGraphPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <AdminPage title="New graph" back={{ href: "/admin/graphs", label: "Graphs" }}>
      <AdminCard>
        <GraphForm subjects={subjects} />
      </AdminCard>
    </AdminPage>
  );
}
