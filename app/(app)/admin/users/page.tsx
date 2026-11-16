import { listUsersAdmin } from "@/admin/queries";
import { UsersPage } from "@/components/admin/UsersPage";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Users · Admin",
  description: "Review sign-in requests and manage who can use Learn.",
  path: "/admin/users",
});

export default async function UsersRoute({ searchParams }: PageProps<"/admin/users">) {
  await connectDb();
  const users = await listUsersAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const statusParam = typeof params.status === "string" ? params.status : undefined;

  return <UsersPage users={users} q={q} statusParam={statusParam} />;
}
