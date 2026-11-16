export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1024) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value, "http://same.invalid");
    if (url.origin !== "http://same.invalid") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function signInPath(next: string | null): string {
  return next && next !== "/" ? `/?next=${encodeURIComponent(next)}` : "/";
}
