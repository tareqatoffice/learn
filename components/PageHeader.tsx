import { trackVar, type TrackName } from "@/components/track";
import { pageTitleBase } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Page title with the area's track colour as a spine, an optional one-line summary and actions on the right. */
export function PageHeader({
  title,
  description,
  track,
  actions,
  titleId,
}: {
  title: string;
  description?: React.ReactNode;
  track?: TrackName;
  actions?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-stretch gap-3">
        {track && (
          <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ background: trackVar(track) }} />
        )}
        <div className="min-w-0">
          <h1 id={titleId} className={cn("text-balance", pageTitleBase)}>
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
