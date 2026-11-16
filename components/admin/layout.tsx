import { BackLink } from "@/components/BackLink";
import { pageTitleClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

// The admin page layout standard. Every admin page is one <AdminPage>; inside it, groups of
// content are <AdminSection>s, forms and settings sit in <AdminCard>s, and rows of items are an
// <AdminList> of <AdminListItem>s (with <EmptyState> when there are none).

const WIDTH = {
  /** Lists, tables and editors that use the full column. */
  full: "",
  /** Same width as full; kept so callers can still pass width="narrow". */
  narrow: "",
} as const;

/**
 * Page shell: optional back link, the title with its primary actions (e.g. "New book") on the right,
 * an optional description, then the content.
 */
export function AdminPage({
  title,
  description,
  back,
  actions,
  width = "full",
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: React.ReactNode };
  actions?: React.ReactNode;
  width?: keyof typeof WIDTH;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-6", WIDTH[width])}>
      <header className="grid gap-2">
        {back && <BackLink href={back.href}>← {back.label}</BackLink>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={cn("min-w-0", pageTitleClass)}>{title}</h1>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {description && <div className="max-w-3xl text-sm text-muted-foreground">{description}</div>}
      </header>
      {children}
    </div>
  );
}

/** A titled group on a page, with its own actions on the right (e.g. "New question"). */
export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3", className)}>
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {children}
    </section>
  );
}

/** The surface for a form or a block of settings; `title` makes it a labelled region. */
export function AdminCard({
  title,
  description,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  // content-start: when a grid of cards stretches one to match a taller neighbour, keep its rows at the top.
  const body = <div className="grid content-start gap-5">{children}</div>;
  if (!title) return <div className={cn("rounded-xl border border-border bg-card p-4 sm:p-5", className)}>{body}</div>;
  return (
    <section className={cn("grid content-start gap-4 rounded-xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="grid gap-1">
        <h2 className="font-semibold">{title}</h2>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {body}
    </section>
  );
}

/** Rows of items in one bordered card; renders `empty` instead when there are no children. */
export function AdminList({
  children,
  empty,
  className,
  label,
}: {
  children: React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const hasRows = Array.isArray(children) ? children.flat().some(Boolean) : Boolean(children);
  if (!hasRows && empty) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul aria-label={label} className={cn("divide-y divide-border rounded-xl border border-border bg-card", className)}>
      {children}
    </ul>
  );
}

/** One row: the main content on the left, its actions on the right (wrapping on narrow screens). */
export function AdminListItem({ children, actions, className }: { children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <li className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-2", className)}>
      <div className="min-w-0">{children}</div>
      {actions}
    </li>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
