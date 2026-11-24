import { formatDuration } from "@/features/focus/context";
import type { FocusReviewData } from "@/features/focus/review";
import { cn } from "@/lib/utils";

const weekday = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });

function streakNote(s: FocusReviewData["streak"]): string {
  if (!s.alive) {
    return s.lastActive
      ? "Your streak ended. That is normal. One short block today starts a new one."
      : "No sessions yet. Start with a short block today.";
  }
  if (s.atRisk) return "Still alive. One block today keeps it going.";
  return "One missed day is forgiven. Two in a row ends it.";
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function ReviewSummary({ d }: { d: FocusReviewData }) {
  const { summary: s, streak, block } = d;
  const max = Math.max(1, ...s.days.map((day) => day.seconds));
  return (
    <section aria-label="This week in numbers" className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Focused time" value={formatDuration(s.totalSeconds)} note={`${s.sessions} ${s.sessions === 1 ? "session" : "sessions"}`} />
        <Tile
          label="Focus rating"
          value={s.avgRating === null ? "–" : `${s.avgRating}/5`}
          note={s.ratedSessions ? `${s.ratedSessions} rated` : "Rate a session to see it"}
        />
        <Tile label="Drifts" value={String(s.drifts)} note="Each return is one rep" />
        <Tile label="Streak" value={`${streak.days} ${streak.days === 1 ? "day" : "days"}`} note={streakNote(streak)} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold">Focused minutes by day</p>
        <ol className="mt-3 grid grid-cols-7 items-end gap-2" style={{ height: "7rem" }}>
          {s.days.map((day) => {
            const pct = Math.round((day.seconds / max) * 100);
            return (
              <li key={day.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
                <span className="text-[0.65rem] tabular-nums text-muted-foreground">
                  {day.seconds ? Math.round(day.seconds / 60) : ""}
                </span>
                <span
                  aria-hidden
                  className={cn("w-full rounded-t bg-primary/70", day.date === d.today && "bg-primary")}
                  style={{ height: `${Math.max(day.seconds ? 6 : 2, pct * 0.6)}%` }}
                />
                <span className="text-xs text-muted-foreground">
                  {weekday(day.date)}
                  <span className="sr-only">
                    {" "}
                    {day.date}: {Math.round(day.seconds / 60)} minutes
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        {s.topDistraction && (
          <p className="mt-3 text-sm text-muted-foreground">
            Most common distraction: <span className="font-medium capitalize text-foreground">{s.topDistraction}</span>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-semibold">
          Suggested block: {block.minutes} minutes{" "}
          <span className="font-normal text-muted-foreground">
            ({block.direction === "up" ? "up" : block.direction === "down" ? "down" : "hold"})
          </span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{block.reason}</p>
      </div>
    </section>
  );
}
