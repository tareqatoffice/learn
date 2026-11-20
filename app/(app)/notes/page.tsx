import { PageHeader } from "@/components/PageHeader";
import { TileGrid } from "@/components/TileGrid";
import { listSeriesWithProgress } from "@/features/content/queries";
import { requireUser } from "@/features/auth/lib/authz";
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
  const read = series.reduce((n, s) => n + s.read, 0);
  const total = series.reduce((n, s) => n + s.total, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Learning notes"
        track="notes"
        description={total > 0 ? `${read} of ${total} chapters read across ${series.length} series.` : undefined}
      />
      <TileGrid
        track="notes"
        empty="No notes published yet."
        tiles={series.map((s) => ({
          key: s.slug,
          href: `/notes/${s.slug}`,
          title: s.title,
          value: s.read,
          max: s.total,
          stat: `${s.read} of ${s.total} chapters read`,
        }))}
      />
    </div>
  );
}
