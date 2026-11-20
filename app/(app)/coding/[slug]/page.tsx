import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { codingGroup } from "@/features/coding/groups";
import { getCodingProgress } from "@/features/coding/progress";
import { readGroupSpecs } from "@/features/coding/specs";
import { CodingGroup } from "@/features/coding/components/CodingGroup";
import { requireUser } from "@/features/auth/lib/authz";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/coding/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const group = codingGroup(slug);
  const title = group?.title ?? "Coding tests";
  return buildMetadata({
    title: `${title} · Coding tests`,
    description: group ? `${group.questions.length} ${group.title} questions with in-browser checks.` : title,
    path: `/coding/${slug}`,
  });
}

export default async function CodingGroupPage({ params }: PageProps<"/coding/[slug]">) {
  const user = await requireUser();
  const { slug } = await params;
  const specs = await readGroupSpecs(slug);
  if (!specs) notFound();
  const progress = await getCodingProgress(user.userId, slug);
  return <CodingGroup slug={slug} specs={specs} initial={progress[slug] ?? {}} />;
}
