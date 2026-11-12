import Link from "next/link";
import { hoursLabel } from "./format";

/**
 * Shown when the study hours available before the test fall short of the rough hours needed. A warning
 * only: it lists the ways to close the gap and changes nothing itself.
 */
export function HoursWarning({ needed, available, profileHref = "/ielts/profile" }: { needed: number; available: number; profileHref?: string | null }) {
  return (
    <div role="status" className="grid gap-1 rounded-xl border border-border bg-card p-4 text-sm">
      <p>
        <span className="font-semibold">Study time may be short.</span> Reaching your target takes about{" "}
        <span className="font-semibold tabular-nums">{hoursLabel(needed)} hours</span>, and your plan has about{" "}
        <span className="font-semibold tabular-nums">{hoursLabel(available)} hours</span> before the test. This is a rough guide, not an
        official figure.
      </p>
      <p className="text-muted-foreground">
        You could study more minutes a day, pick a later test date, or lower your target. Nothing changes until you choose
        {profileHref ? (
          <>
            {" "}
            in your{" "}
            <Link href={profileHref} className="underline underline-offset-2">
              profile
            </Link>
          </>
        ) : null}
        .
      </p>
    </div>
  );
}
