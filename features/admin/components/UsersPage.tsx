import { Search } from "lucide-react";
import Link from "next/link";
import type { AdminUserRow } from "@/features/admin/queries";
import { UserAccessActions, UserAccessFlash } from "@/features/admin/components/UserAccessActions";
import { inputClass } from "@/features/admin/components/SaveBar";
import { AdminList, AdminListItem, AdminPage } from "@/features/admin/components/layout";
import { chipClass } from "@/components/Chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

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

const BADGE: Record<AdminUserRow["status"], { label: string; variant: "ring" | "ok" | "destructive" }> = {
  pending: { label: "Pending", variant: "ring" },
  approved: { label: "Approved", variant: "ok" },
  blocked: { label: "Blocked", variant: "destructive" },
};

function UserRow({ user: u }: { user: AdminUserRow }) {
  const badge = BADGE[u.status];
  return (
    <AdminListItem
      className="items-start py-3"
      actions={
        u.isAdmin ? (
          <p className="text-xs text-muted-foreground sm:pt-1">Can&apos;t be blocked</p>
        ) : (
          <UserAccessActions id={u.id} email={u.email} status={u.status} />
        )
      }
    >
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
              <Badge variant="muted">Admin</Badge>
            ) : (
              <Badge variant={badge.variant}>{badge.label}</Badge>
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
    </AdminListItem>
  );
}

export function UsersPage({
  users,
  q,
  statusParam,
}: {
  users: AdminUserRow[];
  q: string;
  statusParam?: string;
}) {
  const counts = {
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    blocked: users.filter((u) => u.status === "blocked").length,
    all: users.length,
  } satisfies Record<Tab, number>;
  const tab: Tab = TABS.some((t) => t.value === statusParam)
    ? (statusParam as Tab)
    : counts.pending > 0
      ? "pending"
      : "all";

  const needle = q.toLowerCase();
  const shown = users
    .filter((u) => tab === "all" || u.status === tab)
    .filter((u) => !needle || u.email.includes(needle) || u.name.toLowerCase().includes(needle));
  if (tab === "pending") shown.sort((a, b) => (a.requestedAt?.getTime() ?? 0) - (b.requestedAt?.getTime() ?? 0));

  const href = (next: Tab) => `/admin/users?${new URLSearchParams({ status: next, ...(q ? { q } : {}) })}`;

  return (
    <AdminPage
      title="Users"
      description={
        <>
          New sign-ins wait here until you approve them. Blocked users lose access on their next request. Admins
          (from <code className="font-mono text-xs">ADMIN_EMAILS</code>) always have access.
        </>
      }
    >

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter users by status" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={href(t.value)}
              aria-current={tab === t.value ? "page" : undefined}
              className={chipClass(tab === t.value, "gap-1.5")}
            >
              {t.label}
              <Badge
                variant={t.value === "pending" && counts.pending > 0 ? "primary" : "default"}
                className="tabular-nums"
              >
                {counts[t.value]}
              </Badge>
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
        <AdminList empty={q ? `No ${tab === "all" ? "" : `${tab} `}users match “${q}”.` : EMPTY[tab]}>
          {shown.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </AdminList>
      </UserAccessFlash>
    </AdminPage>
  );
}
