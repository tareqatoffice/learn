"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startKeepFitAction } from "@/app/(app)/exercise/actions";
import { Notice } from "@/components/Notice";
import { Panel } from "@/components/Panel";
import { Button, buttonVariants } from "@/components/ui/button";

export type FinishedResult = { startKg: number; goalKg: number; finalKg: number; reached: boolean };

export function PlanFinished({ result }: { result: FinishedResult }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function keepFit() {
    start(async () => {
      const res = await startKeepFitAction();
      if (!res.ok) {
        setError(res.errors._ ?? "Could not start Keep fit.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Panel title={result.reached ? "Goal reached" : "Your goal period has ended"} track="exercise" className="gap-4 p-5">
      <p className="text-sm">
        You started at {result.startKg} kg, aimed for {result.goalKg} kg and ended at about {result.finalKg} kg.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/exercise/setup" className={buttonVariants()}>
          New goal
        </Link>
        <Button type="button" variant="outline" disabled={pending} onClick={keepFit}>
          Keep fit
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Keep fit holds your current weight for three months with the same schedule.</p>
      {error && <Notice>{error}</Notice>}
    </Panel>
  );
}
