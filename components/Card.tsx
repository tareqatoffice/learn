import { cn } from "@/lib/utils";

export const cardClass = "rounded-xl border border-border bg-card p-5";

type CardTag = "div" | "section" | "article" | "li" | "ul" | "ol" | "form" | "figure" | "details" | "p" | "aside";

export function Card<T extends CardTag = "div">({
  as,
  className,
  ...props
}: { as?: T } & React.ComponentProps<T>) {
  const Tag = (as ?? "div") as React.ElementType;
  return <Tag className={cn(cardClass, className)} {...props} />;
}
