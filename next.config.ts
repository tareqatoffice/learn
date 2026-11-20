import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/csp";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
  // The coding-test pages read question specs from the source files at runtime.
  outputFileTracingIncludes: {
    "/coding/[slug]": ["./coding/problems/**/*.ts", "./coding/problems/**/*.tsx"],
  },
  experimental: {
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
