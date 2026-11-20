const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}

/** `m:ss` timer text (minutes keep counting past 60). Negative or non-finite input shows `0:00`. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Like `clock`, but switches to `h:mm:ss` from one hour up. */
export function clockWithHours(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  if (s < 3600) return clock(s);
  return `${Math.floor(s / 3600)}:${clock(s % 3600).padStart(5, "0")}`;
}
