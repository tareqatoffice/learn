import { buttonVariants } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Export · Admin",
  description: "Download every content collection as a backup.",
  path: "/admin/export",
});

export default function ExportPage() {
  return (
    <section className="grid max-w-2xl gap-4">
      <h1 className="text-2xl font-semibold">Export content</h1>
      <p className="text-sm">
        Downloads every book, question, graph, topic, note series, chapter and
        subject as one JSON file. Users, progress and edit history are not
        included.
      </p>
      {/* A plain link: the route streams a file download, which client-side navigation would not handle. */}
      <a
        href="/api/admin/export"
        className={buttonVariants({ className: "justify-self-start" })}
        download
      >
        Download content export
      </a>
      <p className="text-sm text-muted-foreground">
        For a full backup that also keeps users, progress and history, run{" "}
        <code>npm run backup -- &lt;file&gt;</code> from the <code>web/</code>{" "}
        folder.
      </p>
    </section>
  );
}
