import { notFound } from "next/navigation";
import { GraphView } from "@/components/GraphView";
import { getGraphView } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";

export default async function GraphPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  await connectDb();
  const data = await getGraphView(user.userId, slug);
  if (!data) notFound();

  return (
    <div className="grid gap-6">
      {/* GraphView reads the selected topic from ?topic= itself. */}
      <GraphView data={data} />
      {data.graph.footer && (
        <footer className="text-sm text-muted-foreground">
          <Markdown source={data.graph.footer} />
        </footer>
      )}
    </div>
  );
}
