import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { getGraphAdmin, listSubjects } from "@/admin/queries";
import { NodeForm } from "@/components/admin/NodeForm";
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
    <section className="grid gap-4">
      <BackLink href={`/admin/graphs/${graphId}`}>
        ← {data.graph.title}
      </BackLink>
      <h1 className="text-2xl font-semibold">New topic</h1>
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
    </section>
  );
}
