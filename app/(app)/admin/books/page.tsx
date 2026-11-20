import Link from "next/link";
import { listBooksAdmin } from "@/features/admin/queries";
import { AdminList, AdminListItem, AdminPage } from "@/features/admin/components/layout";
import { RowActions } from "@/features/admin/components/RowActions";
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
    <AdminPage
      title="Question books"
      actions={
        <Link href="/admin/books/new" className={buttonVariants({ size: "sm" })}>
          New book
        </Link>
      }
    >
      <AdminList empty="No books yet.">
        {books.map((item) => (
          <AdminListItem
            key={item.id}
            actions={<RowActions kind="book" id={item.id} status={item.status} label={item.title} />}
          >
            <Link href={`/admin/books/${item.id}`} className="font-medium hover:underline">
              {item.title}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">{item.slug} · {item.questions} questions</span>
          </AdminListItem>
        ))}
      </AdminList>
    </AdminPage>
  );
}
