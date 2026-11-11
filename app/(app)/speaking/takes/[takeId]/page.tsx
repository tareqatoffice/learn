import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clock } from "@/components/speaking/format";
import { TakeReview } from "@/components/speaking/TakeReview";
import { getAiConfig } from "@/lib/aiSettings";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { getEffectiveSettings } from "@/speaking/settings";
import { getTake } from "@/speaking/takes";
import { TASK_LABEL } from "@/speaking/tasks";

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
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <Link href="/speaking/history" className="text-sm text-muted-foreground hover:underline">
          ← All takes
        </Link>
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Recording storage isn&apos;t set up yet, so recordings can&apos;t be played.
        </p>
      </div>
    );
  }

  const take = await getTake(user.userId, takeId);
  if (!take) notFound();
  // Only whether the coach is on reaches the page; the key never does.
  const [ai, settings] = await Promise.all([getAiConfig(), getEffectiveSettings(user.userId)]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <div>
        <Link href="/speaking/history" className="text-sm text-muted-foreground hover:underline">
          ← All takes
        </Link>
        <h1 className={pageTitleClass}>{take.material.title?.trim() || TASK_LABEL[take.task]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {TASK_LABEL[take.task]} · {DATE.format(new Date(`${take.date}T00:00:00Z`))} · {clock(take.durationSec)} ·{" "}
          {take.kind === "video" ? "video" : "audio"}
        </p>
      </div>
      <TakeReview take={take} aiOn={ai.settings.active} bodyConsent={settings.bodyConsent} />
    </div>
  );
}
