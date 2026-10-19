import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
