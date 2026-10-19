import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookAdmin, getQuestionAdmin, listSubjects } from "@/admin/queries";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { connectDb } from "@/lib/db";

export default async function EditQuestionPage({ params }: { params: Promise<{ bookId: string; questionId: string }> }) {
  const { bookId, questionId } = await params;
  await connectDb();
  const [book, data, subjects] = await Promise.all([getBookAdmin(bookId), getQuestionAdmin(questionId), listSubjects()]);
  if (!book || !data || data.question.bookId !== bookId) notFound();

  return (
    <section className="grid gap-4">
      <Link href={`/admin/books/${bookId}`} className="text-sm text-muted-foreground hover:underline">
        ← {book.book.title}
      </Link>
      <h1 className="text-2xl font-semibold">Edit question</h1>
      <QuestionForm question={data.question} parts={book.book.parts} subjects={subjects} topics={data.topics} />
    </section>
  );
}
