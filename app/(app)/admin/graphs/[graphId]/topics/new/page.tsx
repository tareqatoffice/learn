import { notFound } from "next/navigation";
import { getGraphAdmin, listSubjects } from "@/features/admin/queries";
import { NodeForm } from "@/features/admin/components/NodeForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";

export default async function NewTopicPage({
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

  return (
    <AdminPage title="New topic" back={{ href: `/admin/graphs/${graphId}`, label: data.graph.title }}>
      <AdminCard>
        <NodeForm
          node={{
            id: "",
            graphId,
            slug: "",
            trackKey: data.graph.tracks[0]?.key ?? "",
            title: "",
            prereqIds: [],
            summary: "",
            points: [],
            code: "",
            pitfall: "",
            docsUrl: "",
            subjects: data.graph.subjects,
            status: "draft",
          }}
          tracks={data.graph.tracks}
          siblings={data.nodes.map((n) => ({ id: n.id, title: n.title }))}
          subjects={subjects}
          graphSubjects={data.graph.subjects}
        />
      </AdminCard>
    </AdminPage>
  );
}
