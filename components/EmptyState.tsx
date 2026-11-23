import { Card } from "@/components/Card";
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
    <Card as="p" role={role} className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </Card>
  );
}
