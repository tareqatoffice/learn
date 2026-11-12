import { SKILLS, type Skill } from "@/ielts/bands";
import type { PlanVersionSummary, PlanView } from "@/ielts/profile";
import { cn } from "@/lib/utils";
import { RemoveAdjustmentButton } from "./PlanActions";
import { PHASE_LABEL, SKILL_LABEL, adjustmentLabel, dateLabel, shortDate, weekMinutes } from "./format";

const PHASE_TONE = { foundation: "bg-muted", skills: "bg-secondary", mocks: "bg-primary/20" } as const;
const UPCOMING_WEEKS = 6;

const dayCount = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
const pct = (done: number, target: number) => (target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0);

function Bar({ label, done, target, note }: { label: string; done: number; target: number; note?: string }) {
  const share = pct(done, target);
  return (
    <li className="grid gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {Math.round(done)} of {target} min
        </span>
      </div>
      <div role="progressbar" aria-label={`${label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="progress-fill h-full rounded-full bg-ok" style={{ width: `${share}%` }} />
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </li>
  );
}

/** The plan page body: phase timeline, this week against its targets, the weeks ahead, standing changes and versions. */
export function PlanTimeline({
  plan,
  today,
  weekIndex,
  progress,
  history,
}: {
  plan: PlanView;
  today: string;
  weekIndex: number | null;
  progress: { done: Record<Skill, number>; fromPractice: number; mocksDone: number } | null;
  history: PlanVersionSummary[];
}) {
  const start = plan.phases[0]?.start;
  const end = plan.phases[plan.phases.length - 1]?.end;
  const total = start && end ? dayCount(start, end) : 0;
  const week = weekIndex === null ? null : plan.weeks[weekIndex];
  const ahead = plan.weeks.slice((weekIndex ?? -1) + 1, (weekIndex ?? -1) + 1 + UPCOMING_WEEKS);

  return (
    <div className="grid gap-4">
      <section aria-labelledby="phases-title" className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="phases-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Phases
        </h2>
        <ol className="flex h-3 overflow-hidden rounded-full" aria-label="Phase timeline">
          {plan.phases.map((p) => (
            <li key={p.name} className={cn("h-full", PHASE_TONE[p.name])} style={{ width: `${(dayCount(p.start, p.end) / total) * 100}%` }}>
              <span className="sr-only">{PHASE_LABEL[p.name]}</span>
            </li>
          ))}
        </ol>
        <ul className="grid gap-1 text-sm">
          {plan.phases.map((p) => (
            <li key={p.name} className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">
                {PHASE_LABEL[p.name]}
                {today >= p.start && today <= p.end && <span className="ml-2 text-xs font-normal text-muted-foreground">now</span>}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {shortDate(p.start)} to {shortDate(p.end)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="week-title" className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="week-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          This week{week ? ` (${shortDate(week.start)} to ${shortDate(week.end)})` : ""}
        </h2>
        {!week || !progress ? (
          <p className="text-sm text-muted-foreground">Today is outside the plan&apos;s weeks.</p>
        ) : (
          <>
            <ul className="grid gap-3">
              {SKILLS.map((s) => (
                <Bar
                  key={s}
                  label={SKILL_LABEL[s]}
                  done={progress.done[s]}
                  target={week.minutes[s]}
                  note={s === "speaking" && progress.fromPractice > 0 ? `Includes ${Math.round(progress.fromPractice)} min from Speaking Practice.` : undefined}
                />
              ))}
            </ul>
            <p className="text-sm text-muted-foreground tabular-nums">
              Mocks: {progress.mocksDone} of {week.mocks}
            </p>
          </>
        )}
      </section>

      {ahead.length > 0 && (
        <section aria-labelledby="ahead-title" className="grid gap-2 rounded-xl border border-border bg-card p-5">
          <h2 id="ahead-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Coming weeks
          </h2>
          <ul className="grid gap-1 text-sm">
            {ahead.map((w) => (
              <li key={w.start} className="flex flex-wrap justify-between gap-2">
                <span className="tabular-nums">
                  {shortDate(w.start)} to {shortDate(w.end)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {weekMinutes(w.minutes)} min · {w.mocks} {w.mocks === 1 ? "mock" : "mocks"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.adjustments.length > 0 && (
        <section aria-labelledby="changes-title" className="grid gap-2 rounded-xl border border-border bg-card p-5">
          <h2 id="changes-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Changes you approved
          </h2>
          <ul className="grid gap-2">
            {plan.adjustments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{adjustmentLabel(a)}</span>
                <RemoveAdjustmentButton id={a.id} label={adjustmentLabel(a)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="versions-title" className="grid gap-2 rounded-xl border border-border bg-card p-5">
        <h2 id="versions-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plan versions
        </h2>
        <ol className="grid gap-1 text-sm">
          {history.map((h) => (
            <li key={h.version}>
              <span className="font-medium tabular-nums">Version {h.version}</span>
              <span className="text-muted-foreground">
                {" "}
                · changed on {dateLabel(h.createdAt.slice(0, 10))}, because {h.reason.charAt(0).toLowerCase()}
                {h.reason.slice(1)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
