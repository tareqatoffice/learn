import Link from "next/link";
import { connectDb } from "@/lib/db";
import {
  Graph,
  GraphNode,
  Note,
  NoteSeries,
  Question,
  QuestionBook,
  User,
} from "@/models";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Admin",
  description: "Content administration for Learn.",
  path: "/admin",
});

export default async function AdminHome() {
  await connectDb();
  const [books, questions, graphs, topics, series, notes, users] =
    await Promise.all([
      QuestionBook.countDocuments(),
      Question.countDocuments(),
      Graph.countDocuments(),
      GraphNode.countDocuments(),
      NoteSeries.countDocuments(),
      Note.countDocuments(),
      User.countDocuments(),
    ]);
  const rows = [
    {
      href: "/admin/books",
      label: "Question books",
      detail: `${books} books · ${questions} questions`,
    },
    {
      href: "/admin/graphs",
      label: "Graphs",
      detail: `${graphs} graphs · ${topics} topics`,
    },
    {
      href: "/admin/notes",
      label: "Note series",
      detail: `${series} series · ${notes} chapters`,
    },
    { href: "/admin/users", label: "Users", detail: `${users} signed up` },
  ];

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <li
            key={r.href}
            className="rounded-xl border border-border bg-card p-4"
          >
            <Link href={r.href} className="font-medium hover:underline">
              {r.label}
            </Link>
            <p className="text-sm text-muted-foreground">{r.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
