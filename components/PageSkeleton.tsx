import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Status({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function ChipRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-8 w-20 rounded-full" />
      ))}
    </div>
  );
}

/** Matches PageHeader: a spine, a title line and an optional description line, with room for actions on the right. */
function HeaderSkeleton({
  titleWidth = "w-56",
  description = true,
  children,
}: {
  titleWidth?: string;
  description?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-stretch gap-3">
        <span aria-hidden className="w-1 shrink-0 rounded-full bg-muted" />
        <div className="grid min-w-0 gap-1">
          <Skeleton className={cn("h-8 max-w-full", titleWidth)} />
          {description && <Skeleton className="h-4 w-64 max-w-full" />}
        </div>
      </div>
      {children}
    </header>
  );
}

function ProgressRows({ count = 3 }: { count?: number }) {
  return (
    <ul className="grid gap-2">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="grid gap-1.5">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-4 w-28 max-w-[60%]" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-2 w-full" />
        </li>
      ))}
    </ul>
  );
}

export function DashboardSkeleton() {
  return (
    <Status label="Loading dashboard" className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-48" />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 gap-6">
          <div className="grid gap-4 rounded-2xl bg-slab p-5 sm:p-8">
            <Skeleton className="h-9 w-72 max-w-full bg-slab-foreground/20" />
            <Skeleton className="h-4 w-80 max-w-full bg-slab-foreground/20" />
            <Skeleton className="h-2.5 w-full bg-slab-foreground/20" />
            <Skeleton className="h-10 w-40 bg-slab-foreground/20" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <section key={i} className="grid content-start gap-2 rounded-xl border border-border bg-card p-4 sm:p-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="h-4 w-36 max-w-full" />
              </section>
            ))}
          </div>
          <section className="grid content-start gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-full" />
            <ProgressRows count={4} />
          </section>
        </div>
        <div className="grid min-w-0 gap-6">
          {Array.from({ length: 3 }, (_, i) => (
            <section key={i} className="grid content-start gap-2 rounded-xl border border-border bg-card p-4 sm:p-5">
              <Skeleton className="h-5 w-32" />
              <ProgressRows count={i === 0 ? 1 : 2} />
            </section>
          ))}
        </div>
      </div>
    </Status>
  );
}

export function CardGridSkeleton({ titleWidth = "w-48" }: { titleWidth?: string }) {
  return (
    <Status label="Loading page" className="grid gap-6">
      <HeaderSkeleton titleWidth={titleWidth} />
      <div className="grid gap-4">
        <ChipRow count={4} />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="grid min-w-0 flex-1 gap-2">
                <Skeleton className="h-5 w-2/3 max-w-48" />
                <Skeleton className="h-4 w-1/2 max-w-32" />
              </div>
              <Skeleton className="size-[52px] shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </Status>
  );
}

export function InterviewIndexSkeleton() {
  return (
    <Status label="Loading page" className="grid gap-6">
      <HeaderSkeleton titleWidth="w-44">
        <Skeleton className="h-8 w-32 rounded-md" />
      </HeaderSkeleton>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-28" />
          <div className="mt-5 grid gap-2">
            <Skeleton className="h-4 w-16" />
            <ChipRow count={3} />
          </div>
          <div className="mt-5 grid gap-2">
            <Skeleton className="h-4 w-28" />
            <ChipRow count={3} />
          </div>
          <div className="mt-5 grid gap-2">
            <Skeleton className="h-4 w-14" />
            <ChipRow count={4} />
          </div>
          <Skeleton className="mt-6 h-10 w-36" />
        </section>
        <div className="grid content-start gap-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-6 w-40" />
            <ul className="mt-3 divide-y divide-border">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="grid gap-2 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Skeleton className="h-5 w-2/3 max-w-xs" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Status>
  );
}

export function BookDetailSkeleton() {
  return (
    <Status label="Loading page" className="grid w-full gap-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-1 h-8 w-64 max-w-full" />
      <Skeleton className="mt-2 h-4 w-36" />
      <Skeleton className="mt-2 h-2 w-full" />
      {Array.from({ length: 2 }, (_, i) => (
        <section key={i} className="mt-10 grid gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-2 w-full" />
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
            {Array.from({ length: 4 }, (_, j) => (
              <li key={j} className="px-4 py-2.5">
                <Skeleton className="h-5 w-3/4 max-w-md" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Status>
  );
}

function OverlayMenuBar() {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 lg:hidden">
      <Skeleton className="h-4 w-40 max-w-[70%]" />
      <Skeleton className="size-4 shrink-0" />
    </div>
  );
}

export function QuestionDetailSkeleton() {
  return (
    <Status
      label="Loading page"
      className="grid gap-4 lg:grid-cols-[13.75rem_minmax(0,48rem)] lg:gap-6"
    >
      <OverlayMenuBar />
      <nav className="hidden space-y-2 lg:block">
        <Skeleton className="h-5 w-32" />
        <ul className="mt-2 grid gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-8 w-full rounded" />
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0">
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="mt-2 h-8 w-full max-w-xl" />
        <section className="mt-4 grid gap-3 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 max-w-full" />
          <Skeleton className="h-4 w-4/5 max-w-full" />
        </section>
        <div className="mt-8 flex justify-between gap-4 border-t border-border pt-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-28" />
        </div>
      </article>
    </Status>
  );
}

export function SeriesDetailSkeleton() {
  return (
    <Status label="Loading page" className="grid gap-6">
      <div className="grid gap-3">
        <Skeleton className="h-4 w-24" />
        <HeaderSkeleton description={false} />
        <Skeleton className="h-2 w-full" />
      </div>
      <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-6 w-28" />
        <ol className="grid gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <li
              key={i}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2"
            >
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-5 w-2/3 max-w-sm" />
              <Skeleton className="h-4 w-12" />
            </li>
          ))}
        </ol>
      </section>
    </Status>
  );
}

export function ChapterDetailSkeleton() {
  return (
    <Status
      label="Loading page"
      className="grid gap-4 lg:grid-cols-[13.75rem_minmax(0,1fr)_12.5rem] lg:gap-6"
    >
      <OverlayMenuBar />
      <OverlayMenuBar />
      <nav className="hidden space-y-2 lg:block">
        <Skeleton className="h-5 w-36" />
        <ul className="mt-2 grid gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-8 w-full rounded" />
            </li>
          ))}
        </ul>
      </nav>
      <article className="mt-2 min-w-0 space-y-4 lg:mt-0">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-40" />
        <div className="mt-6 grid gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 max-w-full" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="h-4 w-4/5 max-w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <footer className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Skeleton className="h-9 w-28" />
          <div className="flex gap-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
          </div>
        </footer>
      </article>
      <nav className="hidden space-y-2 lg:block">
        <Skeleton className="h-4 w-24" />
        <ul className="mt-2 grid gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-4 w-full" />
            </li>
          ))}
        </ul>
      </nav>
    </Status>
  );
}

export function QuizPageSkeleton() {
  return (
    <Status label="Loading page" className="w-full">
      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-7 w-4/5 max-w-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </section>
    </Status>
  );
}

export function GraphDetailSkeleton() {
  return (
    <Status label="Loading page" className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 grid gap-1">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="w-full sm:w-72">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-2 h-2 w-full" />
        </div>
      </header>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex items-center justify-end gap-1 border-b border-border px-2 py-1.5">
            <Skeleton className="size-7" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="size-7" />
          </div>
          <Skeleton className="h-[28rem] w-full rounded-none" />
        </div>
        <div className="grid content-start gap-3 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 max-w-full" />
          <Skeleton className="mt-2 h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </Status>
  );
}

export function AdminPageSkeleton() {
  return (
    <Status label="Loading admin" className="grid gap-6">
      <HeaderSkeleton titleWidth="w-40" description={false}>
        <Skeleton className="h-8 w-28" />
      </HeaderSkeleton>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 px-4 py-2"
          >
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
            <Skeleton className="h-8 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </Status>
  );
}

export function NarrowStackSkeleton({
  label = "Loading page",
  header = "actions",
}: {
  label?: string;
  header?: "actions" | "chips";
}) {
  return (
    <Status label={label} className="grid w-full gap-6">
      <HeaderSkeleton titleWidth="w-48" description={false}>
        {header === "chips" ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-md" />
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        )}
      </HeaderSkeleton>
      <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
      </section>
      <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
          >
            <div className="grid gap-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </section>
    </Status>
  );
}

export function AppPageSkeleton() {
  return <NarrowStackSkeleton />;
}

export function SimplePageSkeleton() {
  return (
    <Status label="Loading" className="grid w-full gap-6">
      <Skeleton className="mx-auto size-11 rounded-full" />
      <Skeleton className="mx-auto h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-2 h-24 w-full rounded-xl" />
      <Skeleton className="h-9 w-full" />
    </Status>
  );
}
