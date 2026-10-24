/**
 * Full backup of every collection (content, users, progress, history, token hashes).
 *
 *   npm run backup -- backups/learn-2026-10-19.json
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { backupAll } from "@/content/backup";
import { connectDb } from "@/lib/db";

async function main(): Promise<void> {
  const webRoot = fileURLToPath(new URL("..", import.meta.url));
  const envFile = path.join(webRoot, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const file = process.argv[2];
  if (!file) throw new Error("usage: npm run backup -- <file>");
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await connectDb();
  try {
    const { counts } = await backupAll(file);
    for (const [name, n] of Object.entries(counts)) console.log(`${name.padEnd(20)} ${n}`);
    console.log(`\nwrote ${file}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
