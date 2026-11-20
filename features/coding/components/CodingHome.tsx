"use client";

import { TileGrid } from "@/components/TileGrid";
import { type CodingProgress, countPassed } from "@/features/coding/checks";
import { groups, topics } from "@/features/coding/problems";
import { countChecks } from "@/features/coding/problems/harness";

const totalChecks: number = groups.reduce((sum, group) => sum + countChecks(group), 0);
const totalQuestions: number = groups.reduce((sum, group) => sum + group.questions.length, 0);

export function CodingHome({ progress }: { progress: CodingProgress }) {
  const passedTotal: number = groups.reduce((sum, group) => sum + countPassed(progress[group.slug]), 0);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {groups.length} groups, {totalQuestions} questions, {passedTotal} / {totalChecks} checks passed
      </p>
      <TileGrid
        track="coding"
        empty="No coding groups yet."
        tiles={topics.flatMap((topic) =>
          topic.groups.map((group) => {
            const checks: number = countChecks(group);
            const passed: number = countPassed(progress[group.slug]);
            return {
              key: group.slug,
              href: `/coding/${group.slug}`,
              title: group.title,
              value: passed,
              max: checks,
              stat: `${group.questions.length} questions, ${passed} / ${checks} checks`,
              badge: { label: group.level, tone: group.level === "Advanced" ? ("primary" as const) : ("muted" as const) },
              group: topic.name,
            };
          }),
        )}
      />
    </>
  );
}
