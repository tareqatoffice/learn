"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { firstError } from "@/admin/result";
import { generateQuestionsAction, startAttemptAction } from "@/app/(app)/ielts/speaking/actions";
import { Notice } from "@/components/Notice";
import { clock } from "@/components/speaking/format";
import { Button } from "@/components/ui/button";
import type { AttemptSummary } from "@/ielts/speaking/attempts";
import type { Kind } from "@/ielts/speaking/questions";
import { cn } from "@/lib/utils";

export type HubOption = { kind: Kind; title: string; blurb: string; exhausted: boolean };

const DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const NAME: Record<Kind, string> = { mock: "Full mock", part1: "Part 1 drill", part2: "Part 2 drill", part3: "Part 3 drill" };

function Option({ option, aiOn, storage, highlight }: { option: HubOption; aiOn: boolean; storage: boolean; highlight: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"start" | "generate" | null>(null);
  const [error, setError] = useState("");
  const { kind, exhausted } = option;

  async function begin(generate: boolean) {
    setBusy(generate ? "generate" : "start");
    setError("");
    try {
      let input: Parameters<typeof startAttemptAction>[0] = { kind };
      if (generate) {
        const made = await generateQuestionsAction(kind);
        if (!made.ok) return setError(made.error);
        input = { kind, questions: made.value, generated: true };
      }
      const res = await startAttemptAction(input);
      if (!res.ok) return setError(firstError(res.errors) ?? "Couldn't start. Try again.");
      router.push(`/ielts/speaking/${res.attemptId}`);
    } catch {
      setError("Couldn't start. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li
      aria-label={option.title}
      data-highlight={highlight ? "true" : undefined}
      className={cn("grid content-start gap-3 rounded-xl border bg-card p-5", highlight ? "border-primary ring-2 ring-primary/30" : "border-border")}
    >
      <div className="grid gap-1">
        <h3 className="font-semibold">
          {option.title}
          {highlight && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">On today&apos;s list</span>}
        </h3>
        <p className="text-sm text-muted-foreground">{option.blurb}</p>
      </div>
      {exhausted && (
        <p className="text-sm text-muted-foreground">
          {aiOn
            ? "You've used every question we have for this. Generate new ones, or repeat earlier ones."
            : "There are no new questions for this. You can repeat earlier ones."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {exhausted && aiOn && (
          <Button onClick={() => begin(true)} disabled={busy !== null || !storage}>
            {busy === "generate" ? "Writing questions…" : "Generate new questions"}
          </Button>
        )}
        <Button variant={exhausted && aiOn ? "outline" : "default"} onClick={() => begin(false)} disabled={busy !== null || !storage}>
          {busy === "start" ? "Starting…" : exhausted ? "Repeat earlier questions" : "Start"}
        </Button>
      </div>
      {error && <Notice>{error}</Notice>}
    </li>
  );
}

/** Start a full mock or drill one part, and open earlier attempts. */
export function SpeakingHub({
  options,
  recent,
  aiOn,
  storage,
  highlightMock,
}: {
  options: HubOption[];
  recent: AttemptSummary[];
  aiOn: boolean;
  storage: boolean;
  highlightMock: boolean;
}) {
  return (
    <div className="grid gap-5">
      {!storage && <Notice tone="info">Recording storage isn&apos;t set up yet, so practice can&apos;t start.</Notice>}
      <section aria-labelledby="start" className="grid gap-3">
        <h2 id="start" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Practise
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <Option key={o.kind} option={o} aiOn={aiOn} storage={storage} highlight={highlightMock && o.kind === "mock"} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent" className="grid gap-3">
        <h2 id="recent" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent attempts
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet. Your attempts show up here after your first practice.</p>
        ) : (
          <ul className="grid gap-2">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/ielts/speaking/${a.id}/review`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span>
                    <span className="font-medium">{NAME[a.kind]}</span>{" "}
                    <span className="text-muted-foreground">
                      · {DATE.format(new Date(`${a.date}T00:00:00Z`))} · {clock(a.durationSec)}
                      {a.status === "incomplete" && " · incomplete"}
                    </span>
                  </span>
                  {typeof a.aiOverall === "number" && (
                    <span className="tabular-nums text-muted-foreground">
                      AI band {a.aiOverall} <span className="text-xs">estimate</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
