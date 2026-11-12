import { notFound } from "next/navigation";
import { getPromptAdmin } from "@/admin/ieltsTests";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { IeltsPromptForm } from "@/components/admin/IeltsPromptForm";
import { connectDb } from "@/lib/db";
import { presignGet, storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ promptId: string }> }) {
  const { promptId } = await params;
  return buildMetadata({ title: "IELTS Writing prompt · Admin", description: "Edit an IELTS Writing prompt.", path: `/admin/ielts/writing/${promptId}` });
}

/** `/admin/ielts/writing/new?task=task1|task2` creates a prompt; any other segment is a prompt id. */
export default async function AdminIeltsPromptPage({
  params,
  searchParams,
}: {
  params: Promise<{ promptId: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const { promptId } = await params;
  await connectDb();
  const isNew = promptId === "new";
  const prompt = isNew ? undefined : await getPromptAdmin(promptId);
  if (!isNew && !prompt) notFound();
  const requested = (await searchParams).task;
  const task = prompt?.task ?? (requested === "task1" || requested === "task2" ? requested : null);
  if (!task) notFound();
  const imagePreviewUrl = prompt?.imageKey && storageConfigured() ? await presignGet(prompt.imageKey) : undefined;
  return (
    <AdminPage title={prompt?.title ?? (task === "task1" ? "New Task 1 prompt" : "New Task 2 prompt")} back={{ href: "/admin/ielts/writing", label: "IELTS Writing" }} width="narrow">
      <AdminCard>
        <IeltsPromptForm key={prompt?.id ?? task} task={task} prompt={prompt ?? undefined} imagePreviewUrl={imagePreviewUrl} />
      </AdminCard>
    </AdminPage>
  );
}
