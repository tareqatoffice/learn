import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { config } from "@/proxy";

// Next anchors the matcher source at both ends before matching the request path.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
  it.each(["/api/admin/svg", "/admin/foo.png", "/admin/books/basico", "/dashboard", "/dashboard/svg", "/api/x.ico"])(
    "proxies %s",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );

  it.each(["/logo.svg", "/_next/static/x.js", "/_next/image", "/favicon.ico", "/img/a.PNG".toLowerCase()])(
    "skips %s",
    (path) => {
      expect(matcher.test(path)).toBe(false);
    },
  );
});
