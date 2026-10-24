export { cn } from "cn"

/** A copy sorted by `order` (missing counts as 0); a missing list gives []. */
export const byOrder = <T extends { order?: number }>(items: readonly T[] = []): T[] =>
  items.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))

/** `s` with every RegExp metacharacter escaped, for matching it literally. */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
