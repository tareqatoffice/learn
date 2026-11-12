import Link from "next/link";
import { WritingHub } from "@/components/ielts/WritingHub";
import { listWritingAttempts } from "@/ielts/writing/attempts";
import type { WritingKind } from "@/ielts/writing/bands";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { IeltsWritingPrompt } from "@/models";

export const metadata = buildMetadata({
  title: "IELTS Writing practice",
  description: "Practise Academic Writing Task 1 and Task 2, rate yourself, then get an AI estimate.",
  path: "/ielts/writing",
});

export default async function IeltsWritingPage() {
  const user = await requireUser();
  await connectDb();
  const [t1, t2, recent] = await Promise.all([
    IeltsWritingPrompt.exists({ task: "task1", status: "published" }),
    IeltsWritingPrompt.exists({ task: "task2", status: "published" }),
    listWritingAttempts(user.userId, 10),
  ]);
  const missing: Record<WritingKind, boolean> = { task1: !t1, task2: !t2, full: !t1 || !t2 };
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>Writing practice</h1>
        <Link href="/ielts" className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Back to IELTS
        </Link>
      </div>
      <WritingHub missing={missing} recent={recent} />
    </div>
  );
}
