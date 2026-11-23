import { TestHub } from "@/features/ielts/components/TestHub";
import { listTestAttempts, listTests } from "@/features/ielts/practice/attempts";
import { requireUser } from "@/features/auth/lib/authz";
import { buildMetadata } from "@/lib/seo";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";

export const metadata = buildMetadata({
  title: "IELTS Listening practice",
  description: "Academic Listening sections with audio, marked for you.",
  path: "/ielts/listening",
});

export default async function IeltsListeningPage() {
  const user = await requireUser();
  const [tests, recent] = await Promise.all([listTests("listening"), listTestAttempts(user.userId, { skill: "listening", limit: 10 })]);
  return (
    <div className="grid w-full gap-6">
      <div className="grid gap-3">
        <BackLink href="/ielts">← IELTS</BackLink>
        <PageHeader title="Listening practice" track="ielts" />
      </div>
      <TestHub skill="listening" tests={tests} recent={recent} />
    </div>
  );
}
