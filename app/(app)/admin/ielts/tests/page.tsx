import Link from "next/link";
import { listTestsAdmin, type TestKind } from "@/admin/ieltsTests";
import { AdminList, AdminListItem, AdminPage, AdminSection } from "@/components/admin/layout";
import { GenerateDraftButton, StatusButton } from "@/components/admin/IeltsContentButtons";
import { buttonVariants } from "@/components/ui/button";
import { getAiConfig } from "@/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "IELTS Reading & Listening · Admin",
  description: "Manage IELTS Reading passages and Listening sections with their questions.",
  path: "/admin/ielts/tests",
});

const KINDS: { kind: TestKind; title: string; description: string; add: string }[] = [
  { kind: "reading", title: "Reading tests", description: "Passages with questions. A full test has three passages and 40 questions.", add: "New reading test" },
  { kind: "listening", title: "Listening tests", description: "Sections with audio and questions. A full test has four sections and 40 questions.", add: "New listening test" },
];

export default async function AdminIeltsTestsPage() {
  await connectDb();
  const [reading, listening, { settings }] = await Promise.all([listTestsAdmin("reading"), listTestsAdmin("listening"), getAiConfig()]);
  const tests = { reading, listening };
  return (
    <AdminPage title="IELTS Reading & Listening" description="Only published tests are offered to learners.">
      {KINDS.map((k) => (
        <AdminSection
          key={k.kind}
          title={k.title}
          description={k.description}
          actions={
            <>
              {settings.active && <GenerateDraftButton what={k.kind} label="Generate draft" />}
              <Link href={`/admin/ielts/tests/${k.kind}/new`} className={buttonVariants({ size: "sm" })}>
                {k.add}
              </Link>
            </>
          }
        >
          <AdminList empty={`No ${k.kind} tests yet.`} label={k.title}>
            {tests[k.kind].map((t) => {
              const questions = t.sections.reduce((n, s) => n + s.count, 0);
              const audio = t.sections.filter((s) => s.audioKey).length;
              return (
                <AdminListItem key={t.id} actions={<StatusButton what={k.kind} id={t.id} status={t.status} label={t.title} />}>
                  <Link href={`/admin/ielts/tests/${k.kind}/${t.id}`} className="font-medium hover:underline">
                    {t.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {[t.status, `${t.sections.length} sections`, `${questions} questions`, k.kind === "listening" ? `${audio}/${t.sections.length} with audio` : "", t.generated ? "AI draft" : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </AdminListItem>
              );
            })}
          </AdminList>
        </AdminSection>
      ))}
    </AdminPage>
  );
}
