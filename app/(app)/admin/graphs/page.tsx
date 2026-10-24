import Link from "next/link";
import { listGraphsAdmin } from "@/admin/queries";
import { RowActions } from "@/components/admin/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";

export const metadata = { title: "Graphs · Admin" };

export default async function AdminGraphsPage() {
  await connectDb();
  const graphs = await listGraphsAdmin();
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Graphs</h1>
        <Link href="/admin/graphs/new" className={buttonVariants({ size: "sm" })}>
          New graph
        </Link>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {graphs.length === 0 && <li className="px-4 py-2 text-sm text-muted-foreground">No graphs yet.</li>}
        {graphs.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
            <span>
              <Link href={`/admin/graphs/${g.id}`} className="font-medium hover:underline">
                {g.title}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {g.slug} · {g.topics} topics
              </span>
            </span>
            <RowActions kind="graph" id={g.id} status={g.status} label={g.title} />
          </li>
        ))}
      </ul>
    </section>
  );
}
