import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookAdmin, listSubjects } from "@/admin/queries";
import { BookForm } from "@/components/admin/BookForm";
import { RowActions } from "@/components/admin/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";

export default async function AdminBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([getBookAdmin(bookId), listSubjects()]);
  if (!data) notFound();
  const partTitle = new Map(data.book.parts.map((p) => [p.key, p.title]));

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <Link href="/admin/books" className="text-sm text-muted-foreground hover:underline">
          ← Question books
        </Link>
        <h1 className="text-2xl font-semibold">{data.book.title}</h1>
        <BookForm book={data.book} subjects={subjects} />
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Questions ({data.questions.length})</h2>
          {data.book.parts.length > 0 ? (
            <Link href={`/admin/books/${bookId}/questions/new`} className={buttonVariants({ size: "sm" })}>
              New question
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Add a part first.</span>
          )}
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.questions.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0 text-sm">
                <Link href={`/admin/books/${bookId}/questions/${q.id}`} className="hover:underline">
                  <Markdown source={q.question} inline />
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">{partTitle.get(q.partKey) ?? q.partKey}</span>
              </span>
              <RowActions kind="question" id={q.id} status={q.status} label={q.question.slice(0, 40)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
