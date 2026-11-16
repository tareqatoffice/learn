/**
 * Where to send someone after sign-in: a same-origin path only. Absolute URLs, protocol-relative
 * `//host`, backslash tricks and control characters are refused, so the value can't send the user
 * to another site. Returns null for anything else, including missing values.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1024) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  // eslint-disable-next-line no-control-regex -- the point is to reject control characters
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  // Parse against a dummy origin: anything that leaves it is not a plain path.
  try {
    const url = new URL(value, "http://same.invalid");
    if (url.origin !== "http://same.invalid") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** The sign-in page address that carries `next` through the sign-in round trip. */
export function signInPath(next: string | null): string {
  return next && next !== "/" ? `/?next=${encodeURIComponent(next)}` : "/";
}
