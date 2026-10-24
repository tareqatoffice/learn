import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/setup/mongo.ts"],
    // Test files share one database and resetDb() empties it, so files must not run concurrently.
    fileParallelism: false,
    include: ["tests/**/*.test.{ts,tsx}"],
    // next-auth imports "next/server" without an extension, which Node's ESM resolver rejects.
    server: { deps: { inline: ["next-auth"] } },
  },
});
