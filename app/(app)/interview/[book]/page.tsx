import { notFound } from "next/navigation";
import { BookView } from "@/features/interview/components/BookView";
import { getBookView } from "@/features/content/queries";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { cache } from "react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

const loadBook = cache(getBookView);

export async function generateMetadata({
  params,
}: PageProps<"/interview/[book]">): Promise<Metadata> {
  const { book: slug } = await params;
  const user = await requireUser();
  await connectDb();
  const view = await loadBook(user.userId, slug);
  return buildMetadata({
    title: view?.book.title ?? "Interview",
    description: view?.book.intro,
    path: `/interview/${encodeURIComponent(slug)}`,
  });
}

export default async function BookPage({
  params,
}: PageProps<"/interview/[book]">) {
  const { book: slug } = await params;
  const user = await requireUser();
  await connectDb();
  const view = await loadBook(user.userId, slug);
  if (!view) notFound();

  return <BookView view={view} />;
}
