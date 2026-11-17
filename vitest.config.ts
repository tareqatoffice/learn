import { spawnSync } from "node:child_process";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(process.cwd()).replace(/^[a-z]:/, (drive) => drive.toUpperCase());
if (process.cwd() !== root && !process.env.VITEST_DRIVE_FIXED) {
  const entryIndex = process.argv.findIndex((arg) => /(?:^|[/\\])vitest(?:\.mjs)?$/.test(arg));
  const userArgs = entryIndex === -1 ? process.argv.slice(2) : process.argv.slice(entryIndex + 1);
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/vitest/vitest.mjs"), ...userArgs], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, VITEST_DRIVE_FIXED: "1" },
  });
  process.exit(result.status ?? 1);
}

const jsdomFiles = [
  "tests/**/*.test.tsx",
  "tests/lib/useExaminer.test.ts",
  "tests/lib/useRecorder.test.ts",
  "tests/lib/media.test.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root.replaceAll("\\", "/")}/` }],
  },
  test: {
    globalSetup: ["./tests/setup/mongo.ts"],
    fileParallelism: false,
    server: { deps: { inline: ["next-auth"] } },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: jsdomFiles,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: jsdomFiles,
        },
      },
    ],
  },
});
