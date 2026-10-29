import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function TitleBlock({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Skeleton className="h-8 w-48 max-w-full" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

function ListRows({ count = 5 }: { count?: number }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="grid gap-2 p-4">
          <Skeleton className="h-5 w-2/3 max-w-sm" />
          <Skeleton className="h-2 w-full" />
        </li>
      ))}
    </ul>
  );
}

/** Dashboard: greeting + three progress cards. */
export function DashboardSkeleton() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <header className="grid gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <section
            key={i}
            className="grid content-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2 w-full" />
          </section>
        ))}
      </div>
    </div>
  );
}

/** Interview / notes / graphs index: title + list. */
export function ListPageSkeleton({
  split = false,
}: {
  /** Interview-style two-column layout. */
  split?: boolean;
}) {
  if (split) {
    return (
      <div
        className="grid gap-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading page"
      >
        <Skeleton className="h-8 w-44" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="grid content-start gap-6">
            <ListRows count={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading page"
    >
      <TitleBlock />
      <ListRows />
    </div>
  );
}

/** Book / series / chapter / topic detail: back link + title + body. */
export function DetailPageSkeleton() {
  return (
    <div
      className="grid gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading page"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-40" />
      <div className="mt-2 grid gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6 max-w-full" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="h-4 w-4/5 max-w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Admin content area (nav stays in layout). */
export function AdminPageSkeleton() {
  return (
    <div
      className="grid gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading admin"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-2 rounded-xl border border-border bg-card p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Generic signed-in fallback. */
export function AppPageSkeleton() {
  return <ListPageSkeleton />;
}

/** Access / simple centered card. */
export function SimplePageSkeleton() {
  return (
    <div
      className="grid w-full gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="mx-auto size-11 rounded-full" />
      <Skeleton className="mx-auto h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-2 h-24 w-full rounded-xl" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
