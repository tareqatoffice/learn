import { listSubjectsAdmin } from "@/admin/queries";
import { SubjectsEditor } from "@/components/admin/SubjectsEditor";
import { connectDb } from "@/lib/db";

export const metadata = { title: "Subjects · Admin" };

export default async function AdminSubjectsPage() {
  await connectDb();
  const subjects = await listSubjectsAdmin();
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Subjects</h1>
      <p className="text-sm text-muted-foreground">Subjects tag books, graphs and notes so they can link to each other. The last row adds a new one.</p>
      <SubjectsEditor subjects={subjects} />
    </section>
  );
}
