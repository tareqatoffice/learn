export { cn } from "cn"

/** A copy sorted by `order` (missing counts as 0); a missing list gives []. */
export const byOrder = <T extends { order?: number }>(items: readonly T[] = []): T[] =>
  items.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))

/** A copy of `list` with `item` removed if present, appended if not. */
export const toggleItem = <T,>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

/** `s` with every RegExp metacharacter escaped, for matching it literally. */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
