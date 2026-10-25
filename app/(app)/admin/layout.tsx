import { notFound } from "next/navigation";
import { AdminNav, type AdminNavGroup } from "@/components/admin/AdminNav";
import { ForbiddenError, requireAdmin } from "@/lib/authz";

const NAV: AdminNavGroup[] = [
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

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    // The proxy already blocks non-admins; this keeps the page closed if it is ever bypassed.
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[12.5rem_minmax(0,1fr)]">
      <AdminNav groups={NAV} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
