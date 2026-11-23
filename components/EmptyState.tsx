import { Card } from "@/components/Card";
import { cn } from "@/lib/utils";

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
