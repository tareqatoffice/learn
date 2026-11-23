"use client";

import Link from "next/link";
import { useState } from "react";
import { saveCodingResultsAction } from "@/app/(app)/coding/actions";
import { firstError } from "@/features/admin/result";
import { type CheckRow, type GroupProgress, countPassed } from "@/features/coding/checks";
import { groups } from "@/features/coding/problems";
import { type Group, type Question, countChecks, runQuestion } from "@/features/coding/problems/harness";
import type { GroupSpecs } from "@/features/coding/specs";
import { BackLink } from "@/components/BackLink";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/Notice";

const DETAIL_MAX = 2000;
const SAVE_FAILED = "The results show here but weren't saved. Check your connection and run again.";

export function CodingGroup({ slug, specs, initial }: { slug: string; specs: GroupSpecs; initial: GroupProgress }) {
  const [results, setResults] = useState<GroupProgress>(initial);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const index: number = groups.findIndex((group) => group.slug === slug);
  const group: Group | undefined = groups[index];
  if (!group) return null;
  const previous: Group | undefined = groups[index - 1];
  const next: Group | undefined = groups[index + 1];

  async function run(targets: readonly Question[]): Promise<void> {
    setError(null);
    const finished: { question: string; checks: CheckRow[] }[] = [];
    try {
      for (const question of targets) {
        setRunning(question.name);
        const checks: CheckRow[] = (await runQuestion(question)).map(({ name, passed, detail }) => ({
          name,
          passed,
          detail: detail.slice(0, DETAIL_MAX),
        }));
        finished.push({ question: question.name, checks });
        setResults((current) => ({ ...current, [question.name]: checks }));
      }
    } finally {
      setRunning(null);
    }
    try {
      const saved = await saveCodingResultsAction({ group: slug, results: finished });
      if (!saved.ok) setError(firstError(saved.errors) ?? SAVE_FAILED);
    } catch {
      setError(SAVE_FAILED);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <header className="grid gap-3">
        <BackLink href="/coding">← All groups</BackLink>
        <PageHeader
          title={group.title}
          track="coding"
          description={specs.intro}
          actions={<Badge variant={group.level === "Advanced" ? "primary" : "muted"}>{group.level}</Badge>}
        />
        <p>
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
            {group.file ?? `coding/problems/${group.slug}/${group.slug}.ts`}
          </code>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void run(group.questions)} disabled={running !== null}>
            {running !== null ? "Running…" : "Run all checks"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {countPassed(results)} / {countChecks(group)} passed
          </span>
        </div>
        {error && (
          <Notice>
            {error}
          </Notice>
        )}
      </header>

      <ol className="grid gap-4">
        {group.questions.map((question, number) => {
          const rows = results[question.name];
          const spec: string | undefined = question.spec ?? specs.questions[question.name];
          return (
            <li key={question.name} className="grid gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-mono font-semibold">
                  {number + 1}. {question.name}
                </h2>
                <Button variant="outline" size="sm" onClick={() => void run([question])} disabled={running !== null}>
                  {running === question.name ? "Running…" : "Run"}
                </Button>
              </div>
              {spec && <p className="text-sm break-words whitespace-pre-wrap">{spec}</p>}
              {question.href && (
                <Link
                  href={question.href}
                  target="_blank"
                  className={buttonVariants({ variant: "link", size: "sm", className: "justify-self-start px-0" })}
                >
                  Open {question.href}
                </Link>
              )}
              <ul className="grid gap-1 text-sm">
                {question.checks.map((item) => {
                  const row = rows?.find((result) => result.name === item.name);
                  return (
                    <li key={item.name}>
                      <span
                        aria-label={!row ? "Not run" : row.passed ? "Passed" : "Failed"}
                        className={cn(
                          "mr-1.5 font-semibold",
                          !row && "text-muted-foreground",
                          row?.passed === true && "text-ok",
                          row?.passed === false && "text-destructive",
                        )}
                      >
                        {!row ? "○" : row.passed ? "✓" : "✗"}
                      </span>
                      {item.name}
                      {row?.detail && <div className="ml-5 text-xs break-words text-destructive">{row.detail}</div>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <nav className="flex justify-between gap-3 text-sm" aria-label="Groups">
        {previous ? (
          <Link href={`/coding/${previous.slug}`} className="hover:underline">
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/coding/${next.slug}`} className="hover:underline">
            {next.title} →
          </Link>
        )}
      </nav>
    </div>
  );
}
