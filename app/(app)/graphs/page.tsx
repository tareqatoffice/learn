import { PageHeader } from "@/components/PageHeader";
import { TileGrid } from "@/components/TileGrid";
import { listGraphsWithProgress } from "@/features/content/queries";
import { requireUser } from "@/features/auth/lib/authz";
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
  const done = graphs.reduce((n, g) => n + g.done, 0);
  const total = graphs.reduce((n, g) => n + g.total, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Learning graphs"
        track="graphs"
        description={total > 0 ? `${done} of ${total} topics done across ${graphs.length} ${graphs.length === 1 ? "graph" : "graphs"}.` : undefined}
      />
      <TileGrid
        track="graphs"
        empty="No graphs published yet."
        tiles={graphs.map((g) => ({
          key: g.slug,
          href: `/graphs/${g.slug}`,
          title: g.title,
          value: g.done,
          max: g.total,
          stat: `${g.done} of ${g.total} topics done`,
        }))}
      />
    </div>
  );
}
