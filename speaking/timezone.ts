import { cookies } from "next/headers";

export const TZ_COOKIE = "tz";

/** True for an IANA zone name this runtime knows (e.g. "Europe/London"). */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The learner's time zone from the `tz` cookie (set by <TimeZoneCookie>), or "UTC". */
export async function readTimeZone(): Promise<string> {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  const decoded = value ? safeDecode(value) : undefined;
  return isTimeZone(decoded) ? decoded : "UTC";
}

function safeDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
