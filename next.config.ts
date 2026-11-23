import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/csp";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
  images: {
  },
  outputFileTracingIncludes: {
    "/coding/[slug]": ["./features/coding/problems/**/*.ts", "./features/coding/problems/**/*.tsx"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    agentUpgrade: "security",
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
