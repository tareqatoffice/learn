import { listUsersAdmin } from "@/admin/queries";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Users · Admin" };

export default async function UsersPage() {
  await connectDb();
  const users = await listUsersAdmin();
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Users ({users.length})</h1>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Last sign-in</th>
              <th className="px-4 py-2 text-right">Questions</th>
              <th className="px-4 py-2 text-right">Topics</th>
              <th className="px-4 py-2 text-right">Chapters</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  {u.email}
                  {u.role === "admin" && <span className="ml-2 text-xs text-muted-foreground">admin</span>}
                </td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{u.questions}</td>
                <td className="px-4 py-2 text-right tabular-nums">{u.topics}</td>
                <td className="px-4 py-2 text-right tabular-nums">{u.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
