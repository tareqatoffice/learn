import { listSubjects } from "@/features/admin/queries";
import { BookForm } from "@/features/admin/components/BookForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";

export default async function NewBookPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <AdminPage title="New book" back={{ href: "/admin/books", label: "Question books" }}>
      <AdminCard>
        <BookForm subjects={subjects} />
      </AdminCard>
    </AdminPage>
  );
}
