import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { listGraphsWithProgress } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Graphs",
  description:
    "Topic graphs laid out by prerequisite so you know what to learn next.",
  path: "/graphs",
});

export default async function GraphsPage() {
  const user = await requireUser();
  await connectDb();
  const graphs = await listGraphsWithProgress(user.userId);

  return (
    <section aria-labelledby="graphs" className="grid gap-4">
      <h1 id="graphs" className="text-2xl font-semibold">
        Learning graphs
      </h1>
      {graphs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No graphs published yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {graphs.map((g) => (
            <li
              key={g.slug}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/graphs/${g.slug}`}
                  className="inline-block font-medium hover:underline pointer-coarse:py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {g.title}
                </Link>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {g.done}/{g.total}
                </span>
              </div>
              <ProgressBar value={g.done} max={g.total} className="mt-2" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
