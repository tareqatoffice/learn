import { notFound } from "next/navigation";
import { SeriesView } from "@/components/notes/SeriesView";
import { getSeriesView } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { cache } from "react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

const loadSeries = cache(getSeriesView);

export async function generateMetadata({
  params,
}: PageProps<"/notes/[series]">): Promise<Metadata> {
  const { series: slug } = await params;
  const user = await requireUser();
  await connectDb();
  const view = await loadSeries(user.userId, slug);
  return buildMetadata({
    title: view?.series.title ?? "Notes",
    description: view?.series.description,
    path: `/notes/${encodeURIComponent(slug)}`,
  });
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ series: string }>;
}) {
  const user = await requireUser();
  const { series: slug } = await params;
  await connectDb();
  const view = await loadSeries(user.userId, slug);
  if (!view) notFound();

  return <SeriesView view={view} />;
}
