import { notFound } from "next/navigation";
import { ADMIN_NAV } from "@/features/admin/nav";
import { AdminNav } from "@/features/admin/components/AdminNav";
import { ForbiddenError, requireAdmin } from "@/features/auth/lib/authz";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[12.5rem_minmax(0,1fr)]">
      <AdminNav groups={ADMIN_NAV} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
