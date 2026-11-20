import { useId } from "react";
import { cn } from "@/lib/utils";
import { trackVar, type TrackName } from "@/components/track";

/** Titled card: the one card chrome shared by every page (dashboard, profile, hubs). */
export function Panel({
  title,
  track,
  action,
  heading: Heading = "h2",
  children,
  className,
}: {
  title: string;
  track?: TrackName;
  action?: React.ReactNode;
  heading?: "h2" | "h3";
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid min-w-0 content-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
      style={
        track
          ? { backgroundImage: `linear-gradient(180deg, color-mix(in oklch, ${trackVar(track)} 8%, transparent), transparent 5rem)` }
          : undefined
      }
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Heading id={id} className="flex min-w-0 items-center gap-2.5 text-base font-semibold tracking-tight">
          {track && (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{
                background: trackVar(track),
                boxShadow: `0 0 0 4px color-mix(in oklch, ${trackVar(track)} 20%, transparent)`,
              }}
            />
          )}
          <span className="truncate">{title}</span>
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
}
