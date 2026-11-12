import { CRITERIA, CRITERION_LABEL, type Criterion, speakingBand } from "@/ielts/bands";
import { cn } from "@/lib/utils";

export const PRONUNCIATION_NOTE =
  "Estimated from the transcript only — the AI can't hear your accent or sounds. Your recording is kept so a later version can check pronunciation from audio.";

/** A gap this big between your band and the AI's is called out. */
const DIFFERS_BY = 1;

type Ai = { bands: Record<Criterion, number>; overall: number };

const Estimate = ({ value }: { value: number }) => (
  <>
    <span className="font-medium">{value}</span> <span className="text-xs text-muted-foreground">estimate</span>
  </>
);

/**
 * Your bands next to the AI's, criterion by criterion. Every AI band is labelled an estimate;
 * a difference of 1.0 or more is highlighted; Pronunciation is greyed because the AI only saw a transcript.
 */
export function BandCompare({ self, ai }: { self: Record<Criterion, number>; ai: Ai }) {
  const mine = speakingBand(self);
  const rows = [
    ...CRITERIA.map((c) => ({ key: c, label: CRITERION_LABEL[c], you: self[c], theirs: ai.bands[c], greyed: c === "pronunciation" })),
    { key: "overall", label: "Speaking band", you: mine, theirs: ai.overall, greyed: false },
  ].map((r) => ({ ...r, differs: !r.greyed && Math.abs(r.you - r.theirs) >= DIFFERS_BY }));
  const anyDiffers = rows.some((r) => r.differs);

  return (
    <div className="grid gap-3">
      <table aria-label="Your bands and the AI estimate" className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2 font-medium">Criterion</th>
            <th className="py-1 pr-2 font-medium">You</th>
            <th className="py-1 font-medium">AI</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr
              key={r.key}
              data-differs={r.differs ? "true" : undefined}
              data-greyed={r.greyed ? "true" : undefined}
              className={cn(
                "border-t border-border align-top",
                r.greyed && "text-muted-foreground",
                r.differs && "bg-amber-100/70 dark:bg-amber-400/15",
                r.key === "overall" && "font-semibold",
              )}
            >
              <td className="py-1.5 pr-2">
                {r.label}
                {r.differs && <span className="sr-only"> (differs by 1.0 or more)</span>}
                {r.greyed && <p className="mt-1 max-w-prose text-xs font-normal">{PRONUNCIATION_NOTE}</p>}
              </td>
              <td className="py-1.5 pr-2">{r.you}</td>
              <td className="py-1.5">
                <Estimate value={r.theirs} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm text-muted-foreground">
        {anyDiffers && "Highlighted rows differ by 1.0 or more. "}
        Pronunciation is never highlighted because the AI can&apos;t hear it. The AI&apos;s bands are estimates from the transcript. Your own judgement stands: you heard the whole recording.
      </p>
    </div>
  );
}
