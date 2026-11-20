import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { buildCsp, frameOptionsFor, isSandboxPath, newNonce } from "@/lib/csp";

describe("Content Security Policy (S2)", () => {
  it("allows scripts only by nonce, blocks framing and plugins, and lets R2 media through", () => {
    const csp = buildCsp({ nonce: "abc", dev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toMatch(/media-src [^;]*https:\/\/\*\.r2\.cloudflarestorage\.com/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/\*\.r2\.cloudflarestorage\.com/);
  });

  it("adds unsafe-eval in development only", () => {
    expect(buildCsp({ nonce: "n", dev: true })).toContain("'unsafe-eval'");
  });

  it("lets only the coding sandbox be framed, and only by this origin", () => {
    for (const path of ["/sandbox", "/sandbox/products/1"]) {
      expect(isSandboxPath(path)).toBe(true);
      expect(buildCsp({ nonce: "n", dev: false, pathname: path })).toContain("frame-ancestors 'self'");
      expect(frameOptionsFor(path)).toBe("SAMEORIGIN");
    }
    for (const path of ["/sandboxed", "/coding", "/"]) {
      expect(isSandboxPath(path)).toBe(false);
      expect(buildCsp({ nonce: "n", dev: false, pathname: path })).toContain("frame-ancestors 'none'");
      expect(frameOptionsFor(path)).toBe("DENY");
    }
  });

  it("makes a fresh nonce each time", () => {
    expect(newNonce()).not.toBe(newNonce());
  });

  it("sends the fixed security headers on every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules[0].source).toBe("/:path*");
    expect(Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000",
      "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
    });
  });
});
