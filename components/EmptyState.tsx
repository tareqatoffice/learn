import { cn } from "@/lib/utils";

/** Muted message in a card box, for empty lists and "not set up yet" states. */
export function EmptyState({
  role,
  className,
  children,
}: {
  role?: "status";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p role={role} className={cn("rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}
