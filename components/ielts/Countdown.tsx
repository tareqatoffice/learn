import { PHASE_LABEL, dateLabel } from "./format";
import type { PhaseName } from "@/ielts/plan";

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** "N days to your test (date)", the current phase and the week of the plan. */
export function Countdown({
  today,
  testDate,
  phase,
  week,
}: {
  today: string;
  testDate: string;
  phase: PhaseName | null;
  week: { index: number; count: number } | null;
}) {
  const days = daysBetween(today, testDate);
  return (
    <section aria-label="Countdown" className="grid gap-1 rounded-xl border border-border bg-card p-5">
      <p className="text-3xl font-semibold tracking-tight tabular-nums">
        {days} {days === 1 ? "day" : "days"}
        <span className="ml-2 text-base font-normal text-muted-foreground">to your test ({dateLabel(testDate)})</span>
      </p>
      {(phase || week) && (
        <p className="text-sm text-muted-foreground">
          {phase && <span>{PHASE_LABEL[phase]} phase</span>}
          {phase && week && " · "}
          {week && (
            <span className="tabular-nums">
              Week {week.index + 1} of {week.count}
            </span>
          )}
        </p>
      )}
    </section>
  );
}
