/** Seconds as m:ss, e.g. 75 -> "1:15". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Minutes with at most one decimal, e.g. 2.25 -> "2.3". */
export function mins(n: number): string {
  return String(Math.round(n * 10) / 10);
}
