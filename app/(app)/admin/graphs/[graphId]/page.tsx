import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { getGraphAdmin, listSubjects } from "@/admin/queries";
import { GraphForm } from "@/components/admin/GraphForm";
import { RowActions } from "@/components/admin/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";

export default async function AdminGraphPage({
  params,
}: {
  params: Promise<{ graphId: string }>;
}) {
  const { graphId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([
    getGraphAdmin(graphId),
    listSubjects(),
  ]);
  if (!data) notFound();
  const trackName = new Map(data.graph.tracks.map((t) => [t.key, t.name]));

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <BackLink href="/admin/graphs">← Graphs</BackLink>
        <h1 className="text-2xl font-semibold">{data.graph.title}</h1>
        <GraphForm graph={data.graph} subjects={subjects} />
      </section>
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Topics ({data.nodes.length})
          </h2>
          <Link
            href={`/admin/graphs/${graphId}/topics/new`}
            className={buttonVariants({ size: "sm" })}
          >
            New topic
          </Link>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.nodes.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
            >
              <span className="text-sm">
                <Link
                  href={`/admin/graphs/${graphId}/topics/${n.id}`}
                  className="font-medium hover:underline"
                >
                  {n.title}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {trackName.get(n.trackKey) ?? n.trackKey}
                </span>
              </span>
              <RowActions
                kind="node"
                id={n.id}
                status={n.status}
                label={n.title}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
