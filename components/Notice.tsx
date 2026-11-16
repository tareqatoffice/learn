import { cn } from "@/lib/utils";

/**
 * A short message beside the control that produced it — a failed save, a rejected value, a result
 * worth a sentence. Seven places used to hand-roll this same paragraph; they all render it now, so
 * the tone, size and announcement stay the same wherever it appears.
 *
 * `error` announces immediately (role="alert"), because something the user asked for did not
 * happen. `info` and `ok` wait their turn (role="status"), and `info` keeps the muted tone used for
 * "nothing matched" results, which are answers rather than faults.
 *
 * For feedback with no control to sit beside — the control has scrolled away, or there is no room —
 * use `toast` from `sonner` instead.
 */
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
