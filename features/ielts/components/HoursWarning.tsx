import Link from "next/link";
import { hoursLabel } from "./format";
import { Card } from "@/components/Card";

export function HoursWarning({ needed, available, profileHref = "/ielts/profile" }: { needed: number; available: number; profileHref?: string | null }) {
  return (
    <Card role="status" className="grid gap-1 p-4 text-sm">
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
    </Card>
  );
}
