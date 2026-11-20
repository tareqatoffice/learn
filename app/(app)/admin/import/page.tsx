import { listSubjects } from "@/features/admin/queries";
import { ImportForm } from "@/features/admin/components/ImportForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Import markdown · Admin",
  description: "Import books, notes and graphs from markdown.",
  path: "/admin/import",
});

export default async function ImportPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <AdminPage
      title="Import markdown"
      description={
        <>
          Paste or upload a question book, note chapters or a graph. Preview shows what would change; nothing is
          written until Commit, and an import never deletes or archives anything. Files pulled with{" "}
          <code>npm run content -- pull</code> carry ids, so edits update the same items.
        </>
      }
    >
      <AdminCard>
        <ImportForm subjectOptions={subjects} />
      </AdminCard>
    </AdminPage>
  );
}
