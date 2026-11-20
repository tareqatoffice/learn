import { getCodingProgress } from "@/features/coding/progress";
import { CodingHome } from "@/features/coding/components/CodingHome";
import { requireUser } from "@/features/auth/lib/authz";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";

export const metadata = buildMetadata({
  title: "Coding tests",
  description: "JavaScript, React and Next.js coding questions with in-browser checks.",
  path: "/coding",
});

export default async function CodingPage() {
  const user = await requireUser();
  const progress = await getCodingProgress(user.userId);

  return (
    <section aria-labelledby="coding" className="grid gap-4">
      <h1 id="coding" className={pageTitleClass}>
        Coding tests
      </h1>
      <p className="text-sm text-muted-foreground">
        Implement each question in the file it names, then run the checks. Solve them locally against{" "}
        <code className="font-mono">npm run dev</code>; the deployed app still has the starter code. No AI assistants:
        documentation only.
      </p>
      <CodingHome progress={progress} />
    </section>
  );
}
