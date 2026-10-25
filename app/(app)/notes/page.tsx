import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { listSeriesWithProgress } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Notes",
  description: "Chaptered study notes that remember where you stopped.",
  path: "/notes",
});

export default async function NotesPage() {
  const user = await requireUser();
  await connectDb();
  const series = await listSeriesWithProgress(user.userId);

  return (
    <section aria-labelledby="notes" className="grid gap-4">
      <h1 id="notes" className="text-2xl font-semibold">
        Learning notes
      </h1>
      {series.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes published yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <li
              key={s.slug}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/notes/${s.slug}`}
                  className="inline-block font-medium hover:underline pointer-coarse:py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {s.title}
                </Link>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {s.read}/{s.total} read
                </span>
              </div>
              <ProgressBar value={s.read} max={s.total} className="mt-2" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
