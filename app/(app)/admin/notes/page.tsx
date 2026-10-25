import Link from "next/link";
import { listSeriesAdmin } from "@/admin/queries";
import { RowActions } from "@/components/admin/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Note series · Admin",
  description: "Manage study note series and chapters.",
  path: "/admin/notes",
});

export default async function AdminNotesPage() {
  await connectDb();
  const series = await listSeriesAdmin();
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Note series</h1>
        <Link
          href="/admin/notes/new"
          className={buttonVariants({ size: "sm" })}
        >
          New series
        </Link>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {series.length === 0 && (
          <li className="px-4 py-2 text-sm text-muted-foreground">
            No series yet.
          </li>
        )}
        {series.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
          >
            <span>
              <Link
                href={`/admin/notes/${s.id}`}
                className="font-medium hover:underline"
              >
                {s.title}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {s.slug} · {s.chapters} chapters
              </span>
            </span>
            <RowActions
              kind="series"
              id={s.id}
              status={s.status}
              label={s.title}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
