import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccessPage } from "@/features/auth/components/AccessPage";
import { accessRecordFor } from "@/features/auth/lib/access";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Account access",
  description: "The status of your request to use Learn.",
  path: "/access",
  noindex: true,
});

export default async function AccessRoute({ searchParams }: PageProps<"/access">) {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) redirect("/");
  const record = await accessRecordFor({ userId: user.id, email: user.email });
  if (!record) redirect("/");
  if (record.status === "approved") redirect("/dashboard");
  const { checked } = await searchParams;

  return (
    <AccessPage
      email={user.email}
      blocked={record.status === "blocked"}
      blockReason={record.blockReason}
      requestedAt={record.requestedAt}
      requestNote={record.requestNote}
      checked={Boolean(checked)}
    />
  );
}
