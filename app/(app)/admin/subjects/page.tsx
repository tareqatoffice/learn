import { listSubjectsAdmin } from "@/features/admin/queries";
import { SubjectsEditor } from "@/features/admin/components/SubjectsEditor";
import { AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Subjects · Admin",
  description: "Manage subjects used to group content.",
  path: "/admin/subjects",
});

export default async function AdminSubjectsPage() {
  await connectDb();
  const subjects = await listSubjectsAdmin();
  return (
    <AdminPage
      title="Subjects"
      description="Subjects tag books, graphs and notes so they can link to each other. The last row adds a new one."
    >
      <SubjectsEditor subjects={subjects} />
    </AdminPage>
  );
}
