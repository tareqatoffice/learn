import Link from "next/link";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Export · Admin",
  description: "Download every content collection as a backup.",
  path: "/admin/export",
});

export default function ExportPage() {
  return (
    <AdminPage
      title="Export content"
      width="narrow"
      description="Downloads all content as one JSON file: subjects, question books and questions, graphs and topics, note series and chapters, speaking lessons and settings, and the IELTS question bank, practice tests, writing prompts and settings. Users, progress, attempts and edit history are not included."
    >
      <AdminCard>
        <Link href="/api/admin/export" className={buttonVariants({ className: "justify-self-start" })} download prefetch={false}>
          Download content export
        </Link>
        <p className="text-sm text-muted-foreground">
          For a full backup that also keeps users, progress, history and settings, run{" "}
          <code>npm run backup -- &lt;file&gt;</code> from the project folder.
        </p>
      </AdminCard>
    </AdminPage>
  );
}
