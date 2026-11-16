/** What a screen reader hears as time runs down: once at five minutes left and once at one. */
export function timeWarning(left: number | null): string {
  if (left === null) return "";
  if (left <= 60 && left > 0) return "One minute left.";
  if (left <= 300 && left > 60) return "Five minutes left.";
  return "";
}

/**
 * Arrow-key movement for a tablist or radiogroup (WAI-ARIA pattern): Left/Up and Right/Down step
 * through `count` items with wrap-around, Home/End jump to the ends. Returns the new index, or null
 * for any other key.
 */
export function rovingIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
