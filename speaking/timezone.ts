import { cookies } from "next/headers";

export const TZ_COOKIE = "tz";

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function readTimeZone(): Promise<string> {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  const decoded = value ? safeDecode(value) : undefined;
  return isTimeZone(decoded) ? decoded : "UTC";
}

export async function hasTimeZoneCookie(): Promise<boolean> {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  return isTimeZone(value ? safeDecode(value) : undefined);
}

function safeDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
