import Link from "next/link";
import { listBooksAdmin } from "@/admin/queries";
import { RowActions } from "@/components/admin/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Question books · Admin",
  description: "Create, edit and publish interview question books.",
  path: "/admin/books",
});

export default async function AdminBooksPage() {
  await connectDb();
  const books = await listBooksAdmin();
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Question books</h1>
        <Link
          href="/admin/books/new"
          className={buttonVariants({ size: "sm" })}
        >
          New book
        </Link>
      </div>
      {books.length === 0 ? (
        <p className="text-sm text-muted-foreground">No books yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {books.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
            >
              <span className="min-w-0">
                <Link
                  href={`/admin/books/${b.id}`}
                  className="font-medium hover:underline"
                >
                  {b.title}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {b.slug} · {b.questions} questions
                </span>
              </span>
              <RowActions
                kind="book"
                id={b.id}
                status={b.status}
                label={b.title}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
