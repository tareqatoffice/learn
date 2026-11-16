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

/** Dashboard: greeting → Next up band → progress cards. */
export function DashboardSkeleton() {
  return (
    <Status label="Loading dashboard" className="grid gap-8">
      <header className="grid gap-1">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </header>

      <section className="grid gap-3">
        <Skeleton className="h-4 w-16" />
        <div className="grid divide-y divide-border rounded-xl border border-border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="grid content-start gap-2 p-4 sm:p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="mt-1 h-8 w-28" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }, (_, i) => (
            <section
              key={i}
              className="grid content-start gap-2 rounded-xl border border-border bg-card p-4"
            >
              <Skeleton className="h-3 w-24" />
              <ProgressRows count={i === 2 ? 2 : 3} />
            </section>
          ))}
        </div>
      </section>
    </Status>
  );
}

/** Notes / graphs index: title + card grid. */
export function CardGridSkeleton({ titleWidth = "w-48" }: { titleWidth?: string }) {
  return (
    <Status label="Loading page" className="grid gap-4">
      <Skeleton className={cn("h-8 max-w-full", titleWidth)} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li
            key={i}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <Skeleton className="h-5 w-2/3 max-w-[12rem]" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="mt-2 h-2 w-full" />
          </li>
        ))}
      </ul>
    </Status>
  );
}

/** Interview index: title row + quiz setup + book list cards. */
export function InterviewIndexSkeleton() {
  return (
    <Status label="Loading page" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
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

/** Book detail: back + title + progress + part question lists. */
export function BookDetailSkeleton() {
  return (
    <Status label="Loading page" className="mx-auto grid w-full max-w-3xl gap-2">
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

/** Question detail: section sidebar + answer card. */
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

/** Note series: header + chapters card. */
export function SeriesDetailSkeleton() {
  return (
    <Status label="Loading page" className="grid max-w-3xl gap-6">
      <header className="grid gap-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-36" />
      </header>
      <section className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-6 w-28" />
        <ol className="mt-3 divide-y divide-border">
          {Array.from({ length: 5 }, (_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 py-2"
            >
              <Skeleton className="h-5 w-2/3 max-w-sm" />
              <Skeleton className="h-4 w-12" />
            </li>
          ))}
        </ol>
      </section>
    </Status>
  );
}

/** Chapter: chapter nav + article + TOC. */
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

/** Quiz session: centered quiz card. */
export function QuizPageSkeleton() {
  return (
    <Status label="Loading page" className="mx-auto w-full max-w-3xl">
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

/** Graph detail: header + canvas + topic panel. */
export function GraphDetailSkeleton() {
  return (
    <Status label="Loading page" className="grid gap-5">
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

/**
 * Admin content area (nav stays in layout).
 * Tuned for list pages (most admin routes); home is a brief flash of the same shell.
 */
export function AdminPageSkeleton() {
  return (
    <Status label="Loading admin" className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-28" />
      </header>
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

/** Speaking / IELTS-style max-w-3xl stack (also catch-all for signed-in routes). */
export function NarrowStackSkeleton({
  label = "Loading page",
  /** IELTS: nav chips share the title row. Speaking: two action buttons. */
  header = "actions",
}: {
  label?: string;
  header?: "actions" | "chips";
}) {
  return (
    <Status label={label} className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-48 max-w-full" />
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
      </div>
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

/** Generic signed-in fallback. */
export function AppPageSkeleton() {
  return <NarrowStackSkeleton />;
}

/** Access / simple centered card. */
export function SimplePageSkeleton() {
  return (
    <Status label="Loading" className="grid w-full gap-4">
      <Skeleton className="mx-auto size-11 rounded-full" />
      <Skeleton className="mx-auto h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-2 h-24 w-full rounded-xl" />
      <Skeleton className="h-9 w-full" />
    </Status>
  );
}
