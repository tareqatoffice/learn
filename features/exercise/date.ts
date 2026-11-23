const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD string that is a real calendar day (rejects 2026-02-30 and 2026-13-01). */
export function isRealDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}
