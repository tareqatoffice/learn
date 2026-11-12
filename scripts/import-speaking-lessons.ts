/**
 * Inserts drafted speaking lessons (from notes and interview questions) as `draft` SpeakingLessons.
 * Dry run by default; nothing is written without --write. Lessons are matched by title, so
 * re-running skips ones that already exist. New lessons get an `order` after the current highest.
 *
 *   npx tsx scripts/import-speaking-lessons.ts                       # dry run
 *   npx tsx scripts/import-speaking-lessons.ts --write               # insert drafts
 *   npx tsx scripts/import-speaking-lessons.ts --file other.json     # another input file
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { SpeakingLesson, Subject } from "@/models";

const MAX_TEXT = 5000;
const DEFAULT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "speaking-lessons.draft.json");

type DraftLesson = {
  key: string;
  title: string;
  subjects: string[];
  shadowText: string;
  durationSec: number;
  passage: string;
  prompt: string;
};

function validate(l: DraftLesson): string | null {
  if (!l.title?.trim()) return "empty title";
  for (const f of ["shadowText", "passage", "prompt"] as const) {
    if (!l[f]?.trim()) return `empty ${f}`;
    if (l[f].length > MAX_TEXT) return `${f} over ${MAX_TEXT} characters`;
  }
  if (!Number.isFinite(l.durationSec) || l.durationSec <= 0) return "bad durationSec";
  return null;
}

export async function main(argv: string[]): Promise<number> {
  const write = argv.includes("--write");
  const fileIdx = argv.indexOf("--file");
  const file = fileIdx >= 0 ? path.resolve(argv[fileIdx + 1]) : DEFAULT_FILE;
  const lessons = JSON.parse(readFileSync(file, "utf8")) as DraftLesson[];

  const bad = lessons.map((l) => ({ key: l.key, why: validate(l) })).filter((x) => x.why);
  if (bad.length) {
    for (const b of bad) console.error(`invalid ${b.key}: ${b.why}`);
    return 1;
  }

  const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  await connectDb();
  const subjects = await Subject.find({}).select("slug").lean<{ _id: unknown; slug: string }[]>();
  const subjectId = new Map(subjects.map((s) => [s.slug, s._id]));

  const existingTitles = new Set((await SpeakingLesson.find({}).select("title").lean<{ title: string }[]>()).map((l) => l.title));
  const last = await SpeakingLesson.findOne({}).sort({ order: -1 }).select("order").lean<{ order: number } | null>();
  let order = last?.order ?? 0;

  const docs: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const l of lessons) {
    if (existingTitles.has(l.title)) {
      skipped++;
      continue;
    }
    existingTitles.add(l.title);
    order += 1;
    docs.push({
      title: l.title,
      order,
      status: "draft",
      subjectIds: l.subjects.map((s) => subjectId.get(s)).filter(Boolean),
      shadow: { text: l.shadowText, durationSec: l.durationSec },
      passage: l.passage,
      prompt: l.prompt,
    });
  }

  console.log(`${lessons.length} in file, ${docs.length} new, ${skipped} already exist (same title)`);
  if (!write) {
    console.log("dry run: nothing written. Pass --write to insert as drafts.");
    return 0;
  }
  await SpeakingLesson.insertMany(docs);
  console.log(`inserted ${docs.length} draft lessons (orders ${order - docs.length + 1}-${order})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => mongoose.disconnect().then(() => process.exit(code)))
    .catch(async (e) => {
      console.error(e);
      await mongoose.disconnect();
      process.exit(1);
    });
}
