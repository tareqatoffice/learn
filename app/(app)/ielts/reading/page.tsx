import { TestHub } from "@/features/ielts/components/TestHub";
import { listTestAttempts, listTests } from "@/features/ielts/practice/attempts";
import { requireUser } from "@/features/auth/lib/authz";
import { buildMetadata } from "@/lib/seo";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";

export const metadata = buildMetadata({
  title: "IELTS Reading practice",
  description: "Timed Academic Reading passages, marked for you.",
  path: "/ielts/reading",
});

export default async function IeltsReadingPage() {
  const user = await requireUser();
  const [tests, recent] = await Promise.all([listTests("reading"), listTestAttempts(user.userId, { skill: "reading", limit: 10 })]);
  return (
    <div className="grid w-full gap-6">
      <div className="grid gap-3">
        <BackLink href="/ielts">← IELTS</BackLink>
        <PageHeader title="Reading practice" track="ielts" />
      </div>
      <TestHub skill="reading" tests={tests} recent={recent} />
    </div>
  );
}
