import { notFound } from "next/navigation";
import { getTestAdmin, type TestKind } from "@/admin/ieltsTests";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { IeltsTestForm } from "@/components/admin/IeltsTestForm";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

const isKind = (k: string): k is TestKind => k === "reading" || k === "listening";

export async function generateMetadata({ params }: { params: Promise<{ kind: string; testId: string }> }) {
  const { kind, testId } = await params;
  return buildMetadata({
    title: `IELTS ${kind} test · Admin`,
    description: "Edit an IELTS test.",
    path: `/admin/ielts/tests/${kind}/${testId}`,
  });
}

/** `/admin/ielts/tests/<kind>/new` creates a test; any other segment is a test id. */
export default async function AdminIeltsTestPage({ params }: { params: Promise<{ kind: string; testId: string }> }) {
  const { kind, testId } = await params;
  if (!isKind(kind)) notFound();
  await connectDb();
  const test = testId === "new" ? undefined : await getTestAdmin(kind, testId);
  if (testId !== "new" && !test) notFound();
  return (
    <AdminPage title={test?.title ?? `New ${kind} test`} back={{ href: "/admin/ielts/tests", label: "Reading & Listening" }} width="narrow">
      <AdminCard>
        <IeltsTestForm key={test?.id ?? "new"} kind={kind} test={test ?? undefined} />
      </AdminCard>
    </AdminPage>
  );
}
