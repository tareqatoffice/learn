import Link from "next/link";
import { notFound } from "next/navigation";
import { ForbiddenError, requireAdmin } from "@/lib/authz";

const NAV = [
  {
    label: "Content",
    links: [
      { href: "/admin/books", label: "Question books" },
      { href: "/admin/graphs", label: "Graphs" },
      { href: "/admin/notes", label: "Note series" },
      { href: "/admin/subjects", label: "Subjects" },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/import", label: "Import markdown" },
      { href: "/admin/revisions", label: "Revisions" },
      { href: "/admin/export", label: "Export" },
      { href: "/admin/tokens", label: "API tokens" },
      { href: "/admin/users", label: "Users" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (error) {
    // The proxy already blocks non-admins; this keeps the page closed if it is ever bypassed.
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Admin" className="grid content-start gap-4 text-sm">
        <Link href="/admin" className="font-semibold hover:underline">
          Admin
        </Link>
        {NAV.map((group) => (
          <div key={group.label} className="grid gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
            {group.links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded px-2 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
