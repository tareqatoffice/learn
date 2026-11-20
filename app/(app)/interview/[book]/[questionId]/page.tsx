import { notFound } from "next/navigation";
import { QuestionView } from "@/features/interview/components/QuestionView";
import { getQuestionView } from "@/features/content/queries";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
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

  return <QuestionView view={view} />;
}
