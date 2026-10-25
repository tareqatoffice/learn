import { BackLink } from "@/components/BackLink";
import { listSubjects } from "@/admin/queries";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { connectDb } from "@/lib/db";

export default async function NewSeriesPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <section className="grid gap-4">
      <BackLink href="/admin/notes">← Note series</BackLink>
      <h1 className="text-2xl font-semibold">New series</h1>
      <SeriesForm subjects={subjects} />
    </section>
  );
}
