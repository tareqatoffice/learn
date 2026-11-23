import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StripDay = {
  date: string;
  done: boolean;
  workout?: { focus: string; minutes: number };
};

const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayName = (date: string) => NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
const dayOfMonth = (date: string) => Number(date.slice(8));

export function WeekStrip({ today, days }: { today: string; days: StripDay[] }) {
  return (
    <ol aria-label="This week" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const isToday = d.date === today;
        const missed = Boolean(d.workout) && !d.done && d.date < today;
        return (
          <li
            key={d.date}
            aria-current={isToday ? "date" : undefined}
            className={cn(
              "grid min-h-24 content-start gap-1 rounded-xl border bg-card p-3 text-sm",
              isToday ? "border-2 border-[var(--t-6)]" : "border-border",
              !d.workout && "text-muted-foreground",
            )}
          >
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-foreground">{dayName(d.date)}</span>
              <span className="text-xs text-muted-foreground">{dayOfMonth(d.date)}</span>
            </p>
            {d.workout ? (
              <>
                <p className="capitalize">{d.workout.focus}</p>
                <p className="text-xs text-muted-foreground">{d.workout.minutes} min</p>
                {d.done && (
                  <p className="flex items-center gap-1 text-xs font-medium text-ok">
                    <Check aria-hidden className="size-3.5" />
                    Done
                  </p>
                )}
                {missed && <p className="text-xs text-muted-foreground">Missed</p>}
                {isToday && !d.done && (
                  <Link href={`/exercise/workout/${d.date}`} className={cn(buttonVariants({ size: "sm" }), "mt-1 w-fit")}>
                    Start
                  </Link>
                )}
              </>
            ) : (
              <p className="text-xs">Rest</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
