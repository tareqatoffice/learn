import Link from "next/link";
import { listSubjects } from "@/admin/queries";
import { GraphForm } from "@/components/admin/GraphForm";
import { connectDb } from "@/lib/db";

export default async function NewGraphPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <section className="grid gap-4">
      <Link href="/admin/graphs" className="text-sm text-muted-foreground hover:underline">
        ← Graphs
      </Link>
      <h1 className="text-2xl font-semibold">New graph</h1>
      <GraphForm subjects={subjects} />
    </section>
  );
}
