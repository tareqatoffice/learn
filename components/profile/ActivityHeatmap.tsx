import type { ActivityDay } from "@/profile/data";
import { cn } from "@/lib/utils";

const level = (count: number) => (count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : 3);

const SHADE = [
  "bg-muted",
  "bg-[color-mix(in_oklch,var(--ok)_30%,var(--muted))]",
  "bg-[color-mix(in_oklch,var(--ok)_60%,var(--muted))]",
  "bg-ok",
] as const;

/** Weeks as columns, Monday at the top. The first column is padded so days line up with weekdays. */
export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (ActivityDay | null)[] = [...Array<null>(days.length ? weekday(days[0].date) : 0).fill(null), ...days];
  const weeks: (ActivityDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const total = days.reduce((n, d) => n + d.count, 0);

  return (
    <figure className="grid gap-2">
      {/* A focusable scroll region so keyboard users can reach the older weeks; the cells are
          decorative and the caption below carries the total. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Activity by day, newest on the right"
        className="flex gap-1 overflow-x-auto pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {weeks.map((week, w) => (
          <div key={w} className="grid gap-1">
            {week.map((d, i) =>
              d ? (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count} ${d.count === 1 ? "activity" : "activities"}`}
                  className={cn("size-3 rounded-sm", SHADE[level(d.count)])}
                />
              ) : (
                <div key={`pad-${i}`} className="size-3" />
              ),
            )}
          </div>
        ))}
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {total} {total === 1 ? "activity" : "activities"} in the last {days.length} days
      </figcaption>
    </figure>
  );
}
