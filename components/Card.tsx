import { cn } from "@/lib/utils";

export const cardClass = "rounded-xl border border-border bg-card p-5";

type CardTag = "div" | "section" | "article" | "li" | "ul" | "ol" | "form" | "figure" | "details" | "p" | "aside";

/** Bordered card box. `as` picks the element; `className` adds or overrides (e.g. `p-4`, `grid gap-3`). */
export function Card<T extends CardTag = "div">({
  as,
  className,
  ...props
}: { as?: T } & React.ComponentProps<T>) {
  const Tag = (as ?? "div") as React.ElementType;
  return <Tag className={cn(cardClass, className)} {...props} />;
}

/** Card-styled link row for lists of past attempts or items. */
export const cardRowLinkClass = cn(
  cardClass,
  "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
);
