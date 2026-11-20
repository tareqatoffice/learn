import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookAdmin, listSubjects } from "@/features/admin/queries";
import { BookForm } from "@/features/admin/components/BookForm";
import { AdminCard, AdminList, AdminListItem, AdminPage, AdminSection } from "@/features/admin/components/layout";
import { RowActions } from "@/features/admin/components/RowActions";
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
    <AdminPage title={data.book.title} back={{ href: "/admin/books", label: "Question books" }}>
      <AdminCard>
        <BookForm book={data.book} subjects={subjects} />
      </AdminCard>

      <AdminSection
        title={`Questions (${data.questions.length})`}
        actions={
          data.book.parts.length > 0 ? (
            <Link href={`/admin/books/${bookId}/questions/new`} className={buttonVariants({ size: "sm" })}>
              New question
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Add a part first.</span>
          )
        }
      >
        <AdminList empty="No questions yet.">
          {data.questions.map((q) => (
            <AdminListItem
              key={q.id}
              actions={<RowActions kind="question" id={q.id} status={q.status} label={q.question.slice(0, 40)} />}
            >
              <span className="text-sm">
                <Link href={`/admin/books/${bookId}/questions/${q.id}`} className="hover:underline">
                  <Markdown source={q.question} inline insideLink />
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">{partTitle.get(q.partKey) ?? q.partKey}</span>
              </span>
            </AdminListItem>
          ))}
        </AdminList>
      </AdminSection>
    </AdminPage>
  );
}
