import { cardClass } from "@/components/Card";
import { cn } from "@/lib/utils";

export const cardRowLinkClass = cn(
  cardClass,
  "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
);
