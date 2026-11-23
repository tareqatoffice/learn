import { cn } from "@/lib/utils";

const TONE = {
  error: "text-destructive",
  info: "text-muted-foreground",
  ok: "text-ok",
} as const;

export function Notice({
  tone = "error",
  as: Tag = "p",
  id,
  className,
  children,
}: {
  tone?: keyof typeof TONE;
  as?: "p" | "span";
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag id={id} role={tone === "error" ? "alert" : "status"} className={cn("text-sm", TONE[tone], className)}>
      {children}
    </Tag>
  );
}
