// Content Security Policy for every proxied page. Pure so it can be tested; the proxy adds a fresh
// nonce per request and Next applies it to its own scripts (see node_modules/next/dist/docs, CSP guide).

/** Presigned R2 links (recordings, IELTS audio and charts, direct uploads) live on these hosts. */
export const R2_ORIGIN = "https://*.r2.cloudflarestorage.com";

export function buildCsp({ nonce, dev }: { nonce: string; dev: boolean }): string {
  return [
    "default-src 'self'",
    // React needs eval in development only, for its error overlays and server stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (charts, layout) and the top loader's style tag.
    "style-src 'self' 'unsafe-inline'",
    // Google avatars, uploaded charts (blob: previews, R2 links).
    `img-src 'self' blob: data: https://*.googleusercontent.com ${R2_ORIGIN}`,
    `media-src 'self' blob: ${R2_ORIGIN}`,
    "font-src 'self'",
    `connect-src 'self' ${R2_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    // Google sign-in posts to Auth.js on this origin, which then redirects to Google.
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function newNonce(): string {
  return btoa(crypto.randomUUID());
}

/** Headers that apply to every response, set in next.config.ts. */
export const STATIC_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
