import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/csp";

const nextConfig: NextConfig = {
  // The Content-Security-Policy needs a per-request nonce, so proxy.ts sets it; these never change.
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
  experimental: {
    // Whole-book imports go to /api/admin/import with their own limit. 2 MB (not the 1 MB default) fits
    // the largest action body: Speaking body-language feedback sends up to six 200 KB video stills.
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
