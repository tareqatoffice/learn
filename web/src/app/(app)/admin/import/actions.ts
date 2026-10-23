"use server";

import { z } from "zod";
import { runImport } from "@/content/import/run";
import { importFields } from "@/content/import/schema";
import type { ImportReport } from "@/content/types";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { issuesMessage } from "@/lib/zod";

const input = z.object({ ...importFields, publish: z.boolean() });
export type ImportInput = z.input<typeof input>;

async function run(raw: ImportInput, dryRun: boolean): Promise<ImportReport | { error: string }> {
  const user = await requireAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: issuesMessage(parsed.error) };
  if (parsed.data.source.kind !== parsed.data.target.kind) return { error: "The source does not match the target kind" };
  await connectDb();
  return runImport({ ...parsed.data, title: parsed.data.title || undefined, dryRun, editedBy: user.email });
}

/** Dry run: reports what would change and writes nothing. */
export async function previewImportAction(raw: ImportInput): Promise<ImportReport | { error: string }> {
  return run(raw, true);
}

export async function commitImportAction(raw: ImportInput): Promise<ImportReport | { error: string }> {
  return run(raw, false);
}
