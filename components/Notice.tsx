import { cn } from "@/lib/utils";

export function Notice({
  tone = "error",
  id,
  className,
  children,
}: {
  tone?: "error" | "info" | "ok";
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const TONE = {
    error: "text-destructive",
    info: "text-muted-foreground",
    ok: "text-ok",
  } as const;
  return (
    <p id={id} role={tone === "error" ? "alert" : "status"} className={cn("text-sm", TONE[tone], className)}>
      {children}
    </p>
  );
}
