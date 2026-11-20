import { getCodingProgress } from "@/features/coding/progress";
import { CodingHome } from "@/features/coding/components/CodingHome";
import { requireUser } from "@/features/auth/lib/authz";
import { PageHeader } from "@/components/PageHeader";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Coding tests",
  description: "JavaScript, React and Next.js coding questions with in-browser checks.",
  path: "/coding",
});

export default async function CodingPage() {
  const user = await requireUser();
  const progress = await getCodingProgress(user.userId);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Coding tests"
        track="coding"
        description={
          <>
            Implement each question in the file it names, then run the checks. Solve them locally against{" "}
            <code className="font-mono">npm run dev</code>; the deployed app still has the starter code. No AI assistants:
            documentation only.
          </>
        }
      />
      <CodingHome progress={progress} />
    </div>
  );
}
