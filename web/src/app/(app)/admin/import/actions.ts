"use server";

import { z } from "zod";
import { runImport } from "@/content/import/run";
import type { ImportReport } from "@/content/types";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

const slug = z.string().regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, digits and dashes");
const input = z.object({
  target: z.object({ kind: z.enum(["book", "series", "graph"]), slug }),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("book"), markdown: z.string().max(3_000_000) }),
    z.object({ kind: z.literal("series"), files: z.array(z.object({ name: z.string().max(200), content: z.string().max(3_000_000) })).max(500) }),
    z.object({ kind: z.literal("graph"), json: z.unknown() }),
  ]),
  title: z.string().max(200).optional(),
  publish: z.boolean(),
});
export type ImportInput = z.input<typeof input>;

async function run(raw: ImportInput, dryRun: boolean): Promise<ImportReport | { error: string }> {
  const user = await requireAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
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
