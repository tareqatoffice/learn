import Link from "next/link";
import { listSubjects } from "@/admin/queries";
import { BookForm } from "@/components/admin/BookForm";
import { connectDb } from "@/lib/db";

export default async function NewBookPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <section className="grid gap-4">
      <Link href="/admin/books" className="text-sm text-muted-foreground hover:underline">
        ← Question books
      </Link>
      <h1 className="text-2xl font-semibold">New book</h1>
      <BookForm subjects={subjects} />
    </section>
  );
}
