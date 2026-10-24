import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookAdmin, listSubjects } from "@/admin/queries";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { connectDb } from "@/lib/db";

export default async function NewQuestionPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([getBookAdmin(bookId), listSubjects()]);
  if (!data || !data.book.parts.length) notFound();

  return (
    <section className="grid gap-4">
      <Link href={`/admin/books/${bookId}`} className="text-sm text-muted-foreground hover:underline">
        ← {data.book.title}
      </Link>
      <h1 className="text-2xl font-semibold">New question</h1>
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
    </section>
  );
}
