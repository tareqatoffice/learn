import { WritingHub } from "@/features/ielts/components/WritingHub";
import { listWritingAttempts } from "@/features/ielts/writing/attempts";
import type { WritingKind } from "@/features/ielts/writing/bands";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { IeltsWritingPrompt } from "@/models";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";

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
    <div className="grid w-full gap-6">
      <div className="grid gap-3">
        <BackLink href="/ielts">← IELTS</BackLink>
        <PageHeader title="Writing practice" track="ielts" />
      </div>
      <WritingHub missing={missing} recent={recent} />
    </div>
  );
}
