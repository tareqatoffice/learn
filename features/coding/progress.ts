import { connectDb } from "@/lib/db";
import { CodingResult } from "@/models";
import type { CheckRow, CodingProgress } from "./checks";
import { codingGroup } from "./groups";

type ResultDoc = { group: string; question: string; checks: CheckRow[] };

export type QuestionResult = { question: string; checks: CheckRow[] };

export async function getCodingProgress(userId: string, group?: string): Promise<CodingProgress> {
  await connectDb();
  const docs = await CodingResult.find({ userId, ...(group ? { group } : {}) }, { group: 1, question: 1, checks: 1 }).lean<
    ResultDoc[]
  >();
  const progress: CodingProgress = {};
  for (const doc of docs) {
    (progress[doc.group] ??= {})[doc.question] = doc.checks.map(({ name, passed, detail }) => ({ name, passed, detail }));
  }
  return progress;
}

export async function saveCodingResults(userId: string, group: string, results: QuestionResult[]): Promise<boolean> {
  const known = codingGroup(group)?.questions;
  if (!known || !results.every((result) => known.includes(result.question))) return false;
  await connectDb();
  await CodingResult.bulkWrite(
    results.map(({ question, checks }) => ({
      updateOne: {
        filter: { userId, group, question },
        update: { $set: { checks, passed: checks.filter((row) => row.passed).length, total: checks.length } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return true;
}
