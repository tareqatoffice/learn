import { notFound } from "next/navigation";
import { GraphView } from "@/components/GraphView";
import { getGraphView } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";

export default async function GraphPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const user = await requireUser();
  const [{ slug }, { topic }] = await Promise.all([params, searchParams]);
  await connectDb();
  const data = await getGraphView(user.userId, slug);
  if (!data) notFound();

  return (
    <div className="grid gap-6">
      <GraphView data={data} initialTopic={typeof topic === "string" ? topic : undefined} />
      {data.graph.footer && (
        <footer className="text-sm text-muted-foreground">
          <Markdown source={data.graph.footer} />
        </footer>
      )}
    </div>
  );
}
