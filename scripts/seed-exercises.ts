/**
 * Loads the starter exercise library into MongoDB and uploads its photos to R2.
 *
 *   npm run seed:exercises              # adds missing exercises and missing photos; never overwrites
 *   npm run seed:exercises -- --photos  # also re-uploads every photo (the old R2 files are deleted)
 *
 * Data: scripts/data/exercises.json. Photos: scripts/data/exercise-images/<id>/0.jpg (start) and 1.jpg (end).
 * Uses MONGODB_URI and the R2_* variables from .env.local (or the environment).
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { deleteObjects, putObject, storageConfigured } from "@/lib/r2";
import { Exercise } from "@/models";

type SeedExercise = {
  id: string;
  name: string;
  focus: string[];
  type: string;
  difficulty: number;
  mode: string;
  equipment: string;
  cues: string[];
  order: number;
};

const SLOTS = [
  ["startPhoto", "0.jpg"],
  ["endPhoto", "1.jpg"],
] as const;

async function main(): Promise<void> {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const envFile = path.join(root, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const replacePhotos = process.argv.includes("--photos");

  const list = JSON.parse(readFileSync(path.join(root, "scripts/data/exercises.json"), "utf8")) as SeedExercise[];
  const imagesDir = path.join(root, "scripts/data/exercise-images");
  const storage = storageConfigured();
  if (!storage) console.warn("R2 is not configured (R2_* variables), so photos are skipped.");

  await connectDb();
  let added = 0;
  let uploaded = 0;
  for (const e of list) {
    const { id, ...fields } = e;
    const res = await Exercise.updateOne({ slug: id }, { $setOnInsert: { slug: id, ...fields } }, { upsert: true });
    if (res.upsertedCount) added++;
    if (!storage) continue;

    const doc = await Exercise.findOne({ slug: id }).lean<{ startPhoto?: string; endPhoto?: string }>();
    for (const [slot, file] of SLOTS) {
      const source = path.join(imagesDir, id, file);
      const current = doc?.[slot] ?? "";
      if (!existsSync(source) || (current && !replacePhotos)) continue;
      const key = `exercise/${id}/${randomBytes(12).toString("hex")}.jpg`;
      await putObject(key, readFileSync(source), "image/jpeg", "public, max-age=31536000, immutable");
      await Exercise.updateOne({ slug: id }, { $set: { [slot]: key } });
      if (current) await deleteObjects([current]);
      uploaded++;
    }
  }
  console.log(`${list.length} exercises: ${added} added, ${uploaded} photos uploaded.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
