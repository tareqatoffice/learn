import Link from "next/link";
import { notFound } from "next/navigation";
import { getGraphAdmin, listSubjects } from "@/features/admin/queries";
import { GraphForm } from "@/features/admin/components/GraphForm";
import { AdminCard, AdminList, AdminListItem, AdminPage, AdminSection } from "@/features/admin/components/layout";
import { RowActions } from "@/features/admin/components/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { connectDb } from "@/lib/db";

export default async function AdminGraphPage({ params }: { params: Promise<{ graphId: string }> }) {
  const { graphId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([getGraphAdmin(graphId), listSubjects()]);
  if (!data) notFound();
  const trackName = new Map(data.graph.tracks.map((t) => [t.key, t.name]));

  return (
    <AdminPage title={data.graph.title} back={{ href: "/admin/graphs", label: "Graphs" }}>
      <AdminCard>
        <GraphForm graph={data.graph} subjects={subjects} />
      </AdminCard>

      <AdminSection
        title={`Topics (${data.nodes.length})`}
        actions={
          <Link href={`/admin/graphs/${graphId}/topics/new`} className={buttonVariants({ size: "sm" })}>
            New topic
          </Link>
        }
      >
        <AdminList empty="No topics yet.">
          {data.nodes.map((n) => (
            <AdminListItem key={n.id} actions={<RowActions kind="node" id={n.id} status={n.status} label={n.title} />}>
              <span className="text-sm">
                <Link href={`/admin/graphs/${graphId}/topics/${n.id}`} className="font-medium hover:underline">
                  {n.title}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">{trackName.get(n.trackKey) ?? n.trackKey}</span>
              </span>
            </AdminListItem>
          ))}
        </AdminList>
      </AdminSection>
    </AdminPage>
  );
}
