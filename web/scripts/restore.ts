/**
 * Loads a full backup or a content export into an EMPTY database, keeping original ids.
 *
 *   npm run restore -- backups/learn-2026-10-19.json
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { restoreAll } from "@/content/backup";
import { connectDb } from "@/lib/db";

async function main(): Promise<void> {
  const webRoot = fileURLToPath(new URL("..", import.meta.url));
  const envFile = path.join(webRoot, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const file = process.argv[2];
  if (!file) throw new Error("usage: npm run restore -- <file>");
  await connectDb();
  try {
    const { counts } = await restoreAll(file);
    for (const [name, n] of Object.entries(counts)) console.log(`${name.padEnd(20)} ${n}`);
    console.log(`\nrestored ${file}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
