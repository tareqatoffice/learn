
export const R2_ORIGIN = "https://*.r2.cloudflarestorage.com";

/** Practice routes for the coding tests; the check runner loads them in a same-origin iframe. */
export const SANDBOX_PATH = "/sandbox";

export const isSandboxPath = (pathname: string): boolean =>
  pathname === SANDBOX_PATH || pathname.startsWith(`${SANDBOX_PATH}/`);

/** X-Frame-Options for a page: only the sandbox may be framed, and only by this origin. */
export const frameOptionsFor = (pathname: string): "SAMEORIGIN" | "DENY" =>
  isSandboxPath(pathname) ? "SAMEORIGIN" : "DENY";

export function buildCsp({ nonce, dev, pathname = "" }: { nonce: string; dev: boolean; pathname?: string }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: https://*.googleusercontent.com ${R2_ORIGIN}`,
    `media-src 'self' blob: ${R2_ORIGIN}`,
    "font-src 'self'",
    `connect-src 'self' ${R2_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${isSandboxPath(pathname) ? "'self'" : "'none'"}`,
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function newNonce(): string {
  return btoa(crypto.randomUUID());
}

export const STATIC_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
