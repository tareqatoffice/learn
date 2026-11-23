import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { clock } from "@/features/speaking/components/format";
import { TakeReview } from "@/features/speaking/components/TakeReview";
import { getAiConfig } from "@/features/ai/lib/aiSettings";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { getEffectiveSettings } from "@/features/speaking/settings";
import { getTake } from "@/features/speaking/takes";
import { TASK_LABEL, TASK_SLUG } from "@/features/speaking/tasks";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export async function generateMetadata({ params }: PageProps<"/speaking/takes/[takeId]">): Promise<Metadata> {
  const { takeId } = await params;
  return buildMetadata({
    title: "Review a take",
    description: "Play back a speaking take, rate yourself and get AI feedback.",
    path: `/speaking/takes/${encodeURIComponent(takeId)}`,
  });
}

const DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export default async function TakePage({ params }: PageProps<"/speaking/takes/[takeId]">) {
  const { takeId } = await params;
  const user = await requireUser();
  await connectDb();

  if (!storageConfigured()) {
    return (
      <div className="grid w-full gap-6">
        <BackLink href="/speaking/history">← All takes</BackLink>
        <EmptyState>
          Recording storage isn&apos;t set up yet, so recordings can&apos;t be played.
        </EmptyState>
      </div>
    );
  }

  const take = await getTake(user.userId, takeId);
  if (!take) notFound();
  const [ai, settings] = await Promise.all([getAiConfig(), getEffectiveSettings(user.userId)]);

  return (
    <div className="grid w-full gap-4">
      <div className="grid gap-3">
        <BackLink href="/speaking/history">← All takes</BackLink>
        <PageHeader
          title={take.material.title?.trim() || TASK_LABEL[take.task]}
          track="speaking"
          description={
            <>
              {TASK_LABEL[take.task]} · {DATE.format(new Date(`${take.date}T00:00:00Z`))} · {clock(take.durationSec)} ·{" "}
              {take.kind === "video" ? "video" : "audio"}
              {take.size ? ` · ${(take.size / 1_000_000).toFixed(1)} MB` : ""}
            </>
          }
          actions={
            <Link href={`/speaking/${TASK_SLUG[take.task]}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Record another
            </Link>
          }
        />
      </div>
      <TakeReview take={take} aiOn={ai.settings.active} bodyConsent={settings.bodyConsent} />
    </div>
  );
}
