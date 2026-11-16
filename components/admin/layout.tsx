import { BackLink } from "@/components/BackLink";
import { pageTitleClass } from "@/lib/ui";
import { cn } from "@/lib/utils";


const WIDTH = {
  full: "",
  narrow: "",
} as const;

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
