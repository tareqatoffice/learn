export { cn } from "cn"

export const byOrder = <T extends { order?: number }>(items: readonly T[] = []): T[] =>
  items.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))

export const toggleItem = <T,>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
