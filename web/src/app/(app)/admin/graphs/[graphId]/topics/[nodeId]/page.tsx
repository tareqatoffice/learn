import Link from "next/link";
import { notFound } from "next/navigation";
import { getGraphAdmin, getNodeAdmin, listSubjects } from "@/admin/queries";
import { NodeForm } from "@/components/admin/NodeForm";
import { connectDb } from "@/lib/db";

export default async function EditTopicPage({ params }: { params: Promise<{ graphId: string; nodeId: string }> }) {
  const { graphId, nodeId } = await params;
  await connectDb();
  const [graph, data, subjects] = await Promise.all([getGraphAdmin(graphId), getNodeAdmin(nodeId), listSubjects()]);
  if (!graph || !data || data.node.graphId !== graphId) notFound();

  return (
    <section className="grid gap-4">
      <Link href={`/admin/graphs/${graphId}`} className="text-sm text-muted-foreground hover:underline">
        ← {graph.graph.title}
      </Link>
      <h1 className="text-2xl font-semibold">{data.node.title}</h1>
      <NodeForm
        node={data.node}
        related={data.related}
        tracks={graph.graph.tracks}
        siblings={graph.nodes.map((n) => ({ id: n.id, title: n.title }))}
        subjects={subjects}
        graphSubjects={graph.graph.subjects}
      />
    </section>
  );
}
