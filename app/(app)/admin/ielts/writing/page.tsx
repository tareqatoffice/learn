import Link from "next/link";
import { listPromptsAdmin } from "@/features/admin/ieltsTests";
import { AdminList, AdminListItem, AdminPage, AdminSection } from "@/features/admin/components/layout";
import { GenerateDraftButton, StatusButton } from "@/features/admin/components/IeltsContentButtons";
import { buttonVariants } from "@/components/ui/button";
import { getAiConfig } from "@/features/ai/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "IELTS Writing · Admin",
  description: "Manage IELTS Writing Task 1 and Task 2 prompts.",
  path: "/admin/ielts/writing",
});

const TASKS = [
  { task: "task1" as const, title: "Task 1 prompts", description: "A chart, graph, table or process to describe, with an image.", add: "New Task 1 prompt" },
  { task: "task2" as const, title: "Task 2 prompts", description: "Essay questions.", add: "New Task 2 prompt" },
];

export default async function AdminIeltsWritingPage() {
  await connectDb();
  const [prompts, { settings }] = await Promise.all([listPromptsAdmin(), getAiConfig()]);
  return (
    <AdminPage title="IELTS Writing" description="Only published prompts are used for practice.">
      {TASKS.map((t) => (
        <AdminSection
          key={t.task}
          title={t.title}
          description={t.description}
          actions={
            <>
              {settings.active && <GenerateDraftButton what={t.task} label="Generate draft" />}
              <Link href={`/admin/ielts/writing/new?task=${t.task}`} className={buttonVariants({ size: "sm" })}>
                {t.add}
              </Link>
            </>
          }
        >
          <AdminList empty="No prompts yet." label={t.title}>
            {prompts
              .filter((p) => p.task === t.task)
              .map((p) => (
                <AdminListItem key={p.id} actions={<StatusButton what="writing" id={p.id} status={p.status} label={p.title} />}>
                  <Link href={`/admin/ielts/writing/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {[p.status, t.task === "task1" ? (p.imageKey ? "has image" : "no image yet") : "", p.generated ? "AI draft" : ""].filter(Boolean).join(" · ")}
                  </span>
                </AdminListItem>
              ))}
          </AdminList>
        </AdminSection>
      ))}
    </AdminPage>
  );
}
