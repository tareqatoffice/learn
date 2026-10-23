const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** "Oct 23, 2026, 9:29 PM" — the timestamp format used across the admin pages. */
export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}
