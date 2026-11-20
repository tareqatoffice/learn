import { notFound } from "next/navigation";
import { getBookAdmin, listSubjects } from "@/features/admin/queries";
import { QuestionForm } from "@/features/admin/components/QuestionForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";

export default async function NewQuestionPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([
    getBookAdmin(bookId),
    listSubjects(),
  ]);
  if (!data || !data.book.parts.length) notFound();

  return (
    <AdminPage title="New question" back={{ href: `/admin/books/${bookId}`, label: data.book.title }}>
      <AdminCard>
        <QuestionForm
          question={{
            id: "",
            bookId,
            partKey: data.book.parts[0].key,
            question: "",
            prompt: "",
            answer: "",
            subjects: data.book.subjects,
            status: "draft",
          }}
          parts={data.book.parts}
          subjects={subjects}
        />
      </AdminCard>
    </AdminPage>
  );
}
