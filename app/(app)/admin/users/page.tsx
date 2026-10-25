import { Search } from "lucide-react";
import Link from "next/link";
import { listUsersAdmin, type AdminUserRow } from "@/admin/queries";
import { UserAccessActions, UserAccessFlash } from "@/components/admin/UserAccessActions";
import { inputClass } from "@/components/admin/SaveBar";
import { Button } from "@/components/ui/button";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata = buildMetadata({
  title: "Users · Admin",
  description: "Review sign-in requests and manage who can use Learn.",
  path: "/admin/users",
});

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "blocked", label: "Blocked" },
  { value: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const EMPTY: Record<Tab, string> = {
  pending: "No requests waiting. New sign-ins show up here for review.",
  approved: "No approved users yet.",
  blocked: "Nobody is blocked.",
  all: "No users have signed in yet.",
};

const BADGE: Record<AdminUserRow["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-ring/40 bg-ring/10 text-ring" },
  approved: { label: "Approved", className: "border-ok/40 bg-ok/10 text-ok" },
  blocked: { label: "Blocked", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await connectDb();
  const users = await listUsersAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const counts = {
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    blocked: users.filter((u) => u.status === "blocked").length,
    all: users.length,
  } satisfies Record<Tab, number>;
  // Open on the review queue while it has anything in it.
  const tab: Tab = TABS.some((t) => t.value === params.status)
    ? (params.status as Tab)
    : counts.pending > 0
      ? "pending"
      : "all";

  const needle = q.toLowerCase();
  const shown = users
    .filter((u) => tab === "all" || u.status === tab)
    .filter((u) => !needle || u.email.includes(needle) || u.name.toLowerCase().includes(needle));
  // Oldest request first, so nobody waits longest.
  if (tab === "pending") shown.sort((a, b) => (a.requestedAt?.getTime() ?? 0) - (b.requestedAt?.getTime() ?? 0));

  const href = (next: Tab) => `/admin/users?${new URLSearchParams({ status: next, ...(q ? { q } : {}) })}`;

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          New sign-ins wait here until you approve them. Blocked users lose access on their next request. Admins
          (from <code className="font-mono text-xs">ADMIN_EMAILS</code>) always have access.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter users by status" className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={href(t.value)}
              aria-current={tab === t.value ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium pointer-coarse:py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                tab === t.value ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  t.value === "pending" && counts.pending > 0 ? "bg-ring text-primary-foreground" : "bg-background",
                )}
              >
                {counts[t.value]}
              </span>
            </Link>
          ))}
        </nav>

        <form role="search" action="/admin/users" className="flex w-full gap-2 sm:w-auto">
          <input type="hidden" name="status" value={tab} />
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input
            id="user-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search name or email"
            className={cn(inputClass, "sm:w-64")}
          />
          <Button type="submit" variant="outline" aria-label="Search">
            <Search aria-hidden />
          </Button>
        </form>
      </div>

      <UserAccessFlash>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {q ? `No ${tab === "all" ? "" : `${tab} `}users match “${q}”.` : EMPTY[tab]}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {shown.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </ul>
        )}
      </UserAccessFlash>
    </section>
  );
}

function UserRow({ user: u }: { user: AdminUserRow }) {
  const badge = BADGE[u.status];
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold"
        >
          {u.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google avatar host; next/image would need a remote pattern
            <img src={u.image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            (u.name || u.email).trim()[0]?.toUpperCase()
          )}
        </span>
        <div className="grid min-w-0 gap-1 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{u.name || u.email}</span>
            {u.isAdmin ? (
              <span className="rounded-full border border-border px-2 text-xs text-muted-foreground">Admin</span>
            ) : (
              <span className={cn("rounded-full border px-2 text-xs font-medium", badge.className)}>{badge.label}</span>
            )}
          </p>
          {u.name && <p className="truncate text-muted-foreground">{u.email}</p>}
          <p className="text-xs text-muted-foreground">
            {u.requestedAt && <>Joined {formatDateTime(u.requestedAt)} · </>}
            {u.lastLoginAt ? `Last sign-in ${formatDateTime(u.lastLoginAt)}` : "Never signed in"}
            {" · "}
            {u.questions} questions · {u.topics} topics · {u.notes} chapters
          </p>
          {u.requestNote && (
            <blockquote className="mt-1 border-l-2 border-ring/50 pl-3 text-sm whitespace-pre-line">
              <span className="sr-only">Note from user: </span>
              {u.requestNote}
            </blockquote>
          )}
          {u.status === "blocked" && u.blockReason && (
            <p className="text-xs text-destructive">Reason: {u.blockReason}</p>
          )}
          {u.reviewedAt && !u.isAdmin && (
            <p className="text-xs text-muted-foreground">
              {u.status === "blocked" ? "Blocked" : "Approved"}
              {u.reviewedBy ? ` by ${u.reviewedBy}` : ""} on {formatDateTime(u.reviewedAt)}
            </p>
          )}
        </div>
      </div>
      {u.isAdmin ? (
        <p className="text-xs text-muted-foreground sm:pt-1">Can&apos;t be blocked</p>
      ) : (
        <UserAccessActions id={u.id} email={u.email} status={u.status} />
      )}
    </li>
  );
}
