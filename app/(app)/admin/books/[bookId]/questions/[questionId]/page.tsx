import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { getBookAdmin, getQuestionAdmin, listSubjects } from "@/admin/queries";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { connectDb } from "@/lib/db";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ bookId: string; questionId: string }>;
}) {
  const { bookId, questionId } = await params;
  await connectDb();
  const [book, data, subjects] = await Promise.all([
    getBookAdmin(bookId),
    getQuestionAdmin(questionId),
    listSubjects(),
  ]);
  if (!book || !data || data.question.bookId !== bookId) notFound();

  return (
    <section className="grid gap-4">
      <BackLink href={`/admin/books/${bookId}`}>← {book.book.title}</BackLink>
      <h1 className="text-2xl font-semibold">Edit question</h1>
      <QuestionForm
        question={data.question}
        parts={book.book.parts}
        subjects={subjects}
        topics={data.topics}
      />
    </section>
  );
}
