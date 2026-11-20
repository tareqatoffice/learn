"use client";

import Link from "next/link";
import { type CodingProgress, countPassed } from "@/features/coding/checks";
import { groups, topics } from "@/features/coding/problems";
import { countChecks } from "@/features/coding/problems/harness";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const totalChecks: number = groups.reduce((sum, group) => sum + countChecks(group), 0);
const totalQuestions: number = groups.reduce((sum, group) => sum + group.questions.length, 0);

export function CodingHome({ progress }: { progress: CodingProgress }) {
  const passedTotal: number = groups.reduce((sum, group) => sum + countPassed(progress[group.slug]), 0);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {groups.length} groups, {totalQuestions} questions, {passedTotal} / {totalChecks} checks passed
      </p>
      {topics.map((topic) => (
        <section key={topic.name} aria-labelledby={`topic-${topic.name}`} className="grid gap-3">
          <h2 id={`topic-${topic.name}`} className="text-lg font-semibold tracking-tight">
            {topic.name}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topic.groups.map((group) => {
              const checks: number = countChecks(group);
              const passed: number = countPassed(progress[group.slug]);
              return (
                <li key={group.slug} className="grid gap-1.5 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/coding/${group.slug}`}
                      className="min-w-0 truncate font-medium hover:underline pointer-coarse:py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {group.title}
                    </Link>
                    <Badge variant={group.level === "Advanced" ? "primary" : "muted"}>{group.level}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {group.questions.length} questions,{" "}
                    <span className={cn(passed === checks && "font-medium text-ok")}>
                      {passed} / {checks} checks
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
