import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { cn } from "@/lib/utils";

const linkClass =
  "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function Card({
  title,
  children,
  className,
  heading: Heading = "h3",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  heading?: "h2" | "h3";
}) {
  const id = `card-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "card-interactive grid min-w-0 content-start gap-2 overflow-hidden rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      <Heading
        id={id}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </Heading>
      {children}
    </section>
  );
}

export function ProgressRows({
  rows,
  empty,
}: {
  rows: {
    key: string;
    href: string;
    label: string;
    value: number;
    max: number;
  }[];
  empty: string;
}) {
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3"
        >
          <Link
            href={r.href}
            className={`truncate text-sm pointer-coarse:py-2 ${linkClass}`}
          >
            {r.label}
          </Link>
          <span className="text-xs tabular-nums text-muted-foreground">
            {r.value}/{r.max}
          </span>
          <ProgressBar value={r.value} max={r.max} className="col-span-2" />
        </li>
      ))}
    </ul>
  );
}
