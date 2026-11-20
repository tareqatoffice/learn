import Link from "next/link";
import { ADMIN_NAV } from "@/features/admin/nav";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { getAiSettings } from "@/features/ai/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { buildMetadata } from "@/lib/seo";
import { ApiToken, Graph, GraphNode, Note, NoteSeries, Question, QuestionBook, Subject, User } from "@/models";

export const metadata = buildMetadata({
  title: "Admin",
  description: "Content administration for Learn.",
  path: "/admin",
});

export default async function AdminHome() {
  await connectDb();
  const [books, questions, graphs, topics, series, notes, subjects, users, pendingUsers, tokens, ai] = await Promise.all([
    QuestionBook.countDocuments(),
    Question.countDocuments(),
    Graph.countDocuments(),
    GraphNode.countDocuments(),
    NoteSeries.countDocuments(),
    Note.countDocuments(),
    Subject.countDocuments(),
    User.countDocuments(),
    User.countDocuments({ status: "pending", email: { $nin: getEnv().ADMIN_EMAILS } }),
    ApiToken.countDocuments({ revokedAt: null }),
    getAiSettings(),
  ]);

  const detail: Record<string, string> = {
    "/admin/books": `${books} books · ${questions} questions`,
    "/admin/graphs": `${graphs} graphs · ${topics} topics`,
    "/admin/notes": `${series} series · ${notes} chapters`,
    "/admin/subjects": `${subjects} subjects`,
    "/admin/users": `${users} signed up${pendingUsers > 0 ? ` · ${pendingUsers} waiting for review` : ""}`,
    "/admin/tokens": `${tokens} active`,
    "/admin/ai": !ai.keyConfigured
      ? "Off · no OpenRouter key"
      : ai.enabled
        ? `On · ${ai.primaryModel}${ai.fallbackModel ? ` (backup ${ai.fallbackModel})` : ""}`
        : "Turned off",
  };
  const hrefOf = (href: string) => (href === "/admin/users" && pendingUsers > 0 ? "/admin/users?status=pending" : href);

  return (
    <AdminPage title="Admin">
      <div className="grid gap-4 lg:grid-cols-2">
        {ADMIN_NAV.map((group) => (
          <AdminCard key={group.label} title={group.label}>
            <ul className="grid gap-3">
              {group.links.map((l) => (
                <li key={l.href} className="grid">
                  <Link href={hrefOf(l.href)} className="font-medium hover:underline">
                    {l.label}
                  </Link>
                  <span className="text-sm text-muted-foreground">{detail[l.href] ?? l.description}</span>
                </li>
              ))}
            </ul>
          </AdminCard>
        ))}
      </div>
    </AdminPage>
  );
}
