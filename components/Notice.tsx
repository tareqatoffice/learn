import { cn } from "@/lib/utils";

const TONE = {
  error: "text-destructive",
  info: "text-muted-foreground",
  ok: "text-ok",
} as const;

export function Notice({
  tone = "error",
  as: Tag = "p",
  alert = true,
  id,
  className,
  children,
}: {
  tone?: keyof typeof TONE;
  as?: "p" | "span";
  /** Error tone only: false drops role="alert" (per-field errors, so several don't announce at once). */
  alert?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag id={id} role={tone === "error" ? (alert ? "alert" : undefined) : "status"} className={cn("text-sm", TONE[tone], className)}>
      {children}
    </Tag>
  );
}
