"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { firstError } from "@/features/admin/result";
import { generateQuestionsAction, startAttemptAction } from "@/app/(app)/ielts/speaking/actions";
import { Notice } from "@/components/Notice";
import { clock } from "@/features/speaking/components/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AttemptSummary } from "@/features/ielts/speaking/attempts";
import type { Kind } from "@/features/ielts/speaking/questions";
import { cn } from "@/lib/utils";
import { cardClass, cardRowLinkClass } from "@/components/Card";

export type HubOption = { kind: Kind; title: string; blurb: string; exhausted: boolean; missing: boolean };

const DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const NAME: Record<Kind, string> = { mock: "Full mock", part1: "Part 1 drill", part2: "Part 2 drill", part3: "Part 3 drill" };

function Option({ option, aiOn, storage, highlight }: { option: HubOption; aiOn: boolean; storage: boolean; highlight: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"start" | "generate" | null>(null);
  const [error, setError] = useState("");
  const { kind, exhausted, missing } = option;

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
      className={cn(cardClass, "grid content-start gap-3", highlight && "border-primary ring-2 ring-primary/30")}
    >
      <div className="grid gap-1">
        <h3 className="font-semibold">
          {option.title}
          {highlight && (
            <Badge variant="primary" className="ml-2">
              On today&apos;s list
            </Badge>
          )}
        </h3>
        <p className="text-sm text-muted-foreground">{option.blurb}</p>
      </div>
      {missing ? (
        <p className="text-sm text-muted-foreground">
          {aiOn
            ? "There aren't enough questions in the bank for this yet. Generate new ones."
            : "Not enough questions in the bank yet — ask your admin to add some"}
        </p>
      ) : (
        exhausted && (
          <p className="text-sm text-muted-foreground">
            {aiOn
              ? "You've used every question we have for this. Generate new ones, or repeat earlier ones."
              : "There are no new questions for this. You can repeat earlier ones."}
          </p>
        )
      )}
      {(aiOn || !missing) && (
        <div className="flex flex-wrap gap-2">
          {(exhausted || missing) && aiOn && (
            <Button onClick={() => begin(true)} disabled={busy !== null || !storage}>
              {busy === "generate" ? "Writing questions…" : "Generate new questions"}
            </Button>
          )}
          {!missing && (
            <Button variant={exhausted && aiOn ? "outline" : "default"} onClick={() => begin(false)} disabled={busy !== null || !storage}>
              {busy === "start" ? "Starting…" : exhausted ? "Repeat earlier questions" : "Start"}
            </Button>
          )}
        </div>
      )}
      {error && <Notice>{error}</Notice>}
    </li>
  );
}

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
                  className={cardRowLinkClass}
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
