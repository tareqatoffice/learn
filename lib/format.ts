const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}
