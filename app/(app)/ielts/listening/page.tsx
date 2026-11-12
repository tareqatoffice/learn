import Link from "next/link";
import { TestHub } from "@/components/ielts/TestHub";
import { listTestAttempts, listTests } from "@/ielts/practice/attempts";
import { requireUser } from "@/lib/authz";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";

export const metadata = buildMetadata({
  title: "IELTS Listening practice",
  description: "Academic Listening sections with audio, marked for you.",
  path: "/ielts/listening",
});

export default async function IeltsListeningPage() {
  const user = await requireUser();
  const [tests, recent] = await Promise.all([listTests("listening"), listTestAttempts(user.userId, { skill: "listening", limit: 10 })]);
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>Listening practice</h1>
        <Link href="/ielts" className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Back to IELTS
        </Link>
      </div>
      <TestHub skill="listening" tests={tests} recent={recent} />
    </div>
  );
}
