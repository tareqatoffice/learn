import { notFound } from "next/navigation";
import { getGraphAdmin, getNodeAdmin, listSubjects } from "@/features/admin/queries";
import { NodeForm } from "@/features/admin/components/NodeForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";

export default async function EditTopicPage({
  params,
}: {
  params: Promise<{ graphId: string; nodeId: string }>;
}) {
  const { graphId, nodeId } = await params;
  await connectDb();
  const [graph, data, subjects] = await Promise.all([
    getGraphAdmin(graphId),
    getNodeAdmin(nodeId),
    listSubjects(),
  ]);
  if (!graph || !data || data.node.graphId !== graphId) notFound();

  return (
    <AdminPage title={data.node.title} back={{ href: `/admin/graphs/${graphId}`, label: graph.graph.title }}>
      <AdminCard>
        <NodeForm
          node={data.node}
          related={data.related}
          tracks={graph.graph.tracks}
          siblings={graph.nodes.map((n) => ({ id: n.id, title: n.title }))}
          subjects={subjects}
          graphSubjects={graph.graph.subjects}
        />
      </AdminCard>
    </AdminPage>
  );
}
