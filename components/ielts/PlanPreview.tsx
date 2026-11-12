import { SKILLS } from "@/ielts/bands";
import type { Adjustment } from "@/ielts/plan";
import type { PlanView } from "@/ielts/profile";
import { PHASE_LABEL, SKILL_LABEL, adjustmentLabel, hoursLabel, shortDate, weekMinutes } from "./format";

function Side({ title, plan }: { title: string; plan: PlanView | null }) {
  const first = plan?.weeks[0];
  return (
    <div className="grid content-start gap-2 rounded-lg border border-border bg-background p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {!plan || !first ? (
        <p className="text-sm text-muted-foreground">No plan yet.</p>
      ) : (
        <>
          <ul className="grid gap-0.5 text-sm">
            {plan.phases.map((p) => (
              <li key={p.name}>
                <span className="font-medium">{PHASE_LABEL[p.name]}</span>{" "}
                <span className="text-muted-foreground">
                  {shortDate(p.start)} to {shortDate(p.end)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm">
            <span className="font-medium tabular-nums">{weekMinutes(first.minutes)} min</span> in the first week
            <span className="text-muted-foreground">
              {" "}
              ({SKILLS.map((s) => `${SKILL_LABEL[s][0]} ${first.minutes[s]}`).join(", ")})
            </span>
            , {first.mocks} {first.mocks === 1 ? "mock" : "mocks"}
          </p>
          <p className="text-sm text-muted-foreground">
            Hours: about {hoursLabel(plan.hours.needed)} needed, {hoursLabel(plan.hours.available)} available.
          </p>
        </>
      )}
    </div>
  );
}

/** A before/after comparison of two plan versions, plus the standing changes the new one drops. */
export function PlanPreview({ before, after, dropped }: { before: PlanView | null; after: PlanView; dropped: Pick<Adjustment, "id" | "kind" | "criterion" | "share" | "minutes">[] }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Side title={before ? `Before (version ${before.version})` : "Before"} plan={before} />
        <Side title={`After (version ${after.version})`} plan={after} />
      </div>
      {dropped.length > 0 && (
        <div className="grid gap-1 rounded-lg border border-border bg-background p-3">
          <p className="text-sm font-medium">These changes are dropped because they no longer fit the new plan:</p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {dropped.map((a) => (
              <li key={a.id}>{adjustmentLabel(a)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
