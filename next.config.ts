import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/csp";

const nextConfig: NextConfig = {
  // The Content-Security-Policy needs a per-request nonce, so proxy.ts sets it; these never change.
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
  experimental: {
    // Admin "Import markdown" posts whole books and note series through Server Actions (default limit 1 MB).
    serverActions: { bodySizeLimit: "10mb" },
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
