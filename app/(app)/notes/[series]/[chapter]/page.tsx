import { notFound } from "next/navigation";
import { ChapterView } from "@/features/notes/components/ChapterView";
import { getChapterView } from "@/features/content/queries";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { openNote } from "@/features/progress/notes";
import { cache } from "react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

const loadChapter = cache(getChapterView);

export async function generateMetadata({
  params,
}: PageProps<"/notes/[series]/[chapter]">): Promise<Metadata> {
  const { series, chapter } = await params;
  const user = await requireUser();
  await connectDb();
  const view = await loadChapter(user.userId, series, chapter);
  return buildMetadata({
    title: view ? `${view.chapter.title} · ${view.series.title}` : "Notes",
    description: view?.chapter.body,
    path: `/notes/${encodeURIComponent(series)}/${encodeURIComponent(chapter)}`,
  });
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ series: string; chapter: string }>;
}) {
  const user = await requireUser();
  const { series, chapter } = await params;
  await connectDb();
  const view = await loadChapter(user.userId, series, chapter);
  if (!view) notFound();
  await openNote(user.userId, view.chapter.id).catch((error: unknown) => {
    console.error(`Couldn't record opening chapter ${view.chapter.id}: ${error instanceof Error ? error.message : String(error)}`);
  });

  return <ChapterView view={view} />;
}
