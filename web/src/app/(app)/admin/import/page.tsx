import { ImportForm } from "@/components/admin/ImportForm";

export const metadata = { title: "Import markdown · Admin" };

export default function ImportPage() {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Import markdown</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Paste or upload a question book, note chapters or a graph. Preview shows what would change; nothing is written until Commit, and an
        import never deletes or archives anything. Files pulled with <code>npm run content -- pull</code> carry ids, so edits update the
        same items.
      </p>
      <ImportForm />
    </section>
  );
}
