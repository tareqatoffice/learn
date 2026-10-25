import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestionView } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";
import { cache } from "react";
import type { Metadata } from "next";
import { buildMetadata, toDescription } from "@/lib/seo";

const loadQuestion = cache(getQuestionView);

export async function generateMetadata({
  params,
}: PageProps<"/interview/[book]/[questionId]">): Promise<Metadata> {
  const { book: bookSlug, questionId } = await params;
  await requireUser();
  await connectDb();
  const view = await loadQuestion(bookSlug, questionId);
  return buildMetadata({
    title: view
      ? toDescription(view.question.question, "Question")
      : "Question",
    description: view?.question.answer,
    path: `/interview/${encodeURIComponent(bookSlug)}/${encodeURIComponent(questionId)}`,
  });
}

export default async function QuestionPage({
  params,
}: PageProps<"/interview/[book]/[questionId]">) {
  const { book: bookSlug, questionId } = await params;
  await requireUser();
  await connectDb();
  const view = await loadQuestion(bookSlug, questionId);
  if (!view) notFound();

  const { question, book, topic } = view;
  return (
    <article className="mx-auto w-full max-w-3xl">
      <p className="text-sm text-muted-foreground">
        <Link href="/interview" className="hover:underline">
          Interview
        </Link>
        {" › "}
        <Link href={`/interview/${book.slug}`} className="hover:underline">
          {book.title}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-snug">
        <Markdown source={question.question} inline />
      </h1>
      {question.prompt && (
        <div className="mt-4">
          <Markdown source={question.prompt} />
        </div>
      )}
      <section
        aria-label="Answer"
        className="mt-4 rounded-lg border border-border bg-card p-4"
      >
        <Markdown source={question.answer} />
      </section>
      {topic && (
        <p className="mt-4 text-sm">
          <Link
            href={`/graphs/${encodeURIComponent(topic.graphSlug)}?topic=${encodeURIComponent(topic.nodeSlug)}`}
            className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Graph topic: {topic.title}
          </Link>
        </p>
      )}
    </article>
  );
}
