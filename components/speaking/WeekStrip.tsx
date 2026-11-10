import { cn } from "@/lib/utils";

const DAY = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });
const FULL = new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

const pct = (fraction: number) => Math.round(Math.min(1, Math.max(0, fraction)) * 100);

/** Seven bars, Sunday first: each fills with the share of that day's target minutes, today outlined. */
export function WeekStrip({ week, today }: { week: { date: string; fraction: number }[]; today: string }) {
  return (
    <ol aria-label="This week" className="grid grid-cols-7 gap-2">
      {week.map((d) => {
        const isToday = d.date === today;
        const share = pct(d.fraction);
        const day = new Date(`${d.date}T00:00:00Z`);
        return (
          <li
            key={d.date}
            data-date={d.date}
            aria-current={isToday ? "date" : undefined}
            className="grid justify-items-center gap-1"
          >
            <div
              data-bar
              className={cn(
                "relative flex h-16 w-full max-w-10 items-end overflow-hidden rounded-md bg-muted",
                isToday && "outline-2 outline-offset-2 outline-ring",
              )}
            >
              <div data-fill className="progress-fill w-full rounded-md bg-ok" style={{ height: `${share}%` }} />
            </div>
            <span className={cn("text-xs", isToday ? "font-semibold" : "text-muted-foreground")}>
              {DAY.format(day)}
            </span>
            <span className="sr-only">
              {FULL.format(day)}: {share}% of target
            </span>
          </li>
        );
      })}
    </ol>
  );
}
