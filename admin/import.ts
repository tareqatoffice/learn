import { z } from "zod";
import { runImport } from "@/content/import/run";
import { importFields } from "@/content/import/schema";
import type { ImportReport } from "@/content/types";
import { issuesMessage } from "@/lib/zod";

const input = z.object({ ...importFields, publish: z.boolean() });
export type ImportInput = z.input<typeof input>;

export async function runAdminImport(raw: unknown, dryRun: boolean, editedBy: string): Promise<ImportReport | { error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: issuesMessage(parsed.error) };
  if (parsed.data.source.kind !== parsed.data.target.kind) return { error: "The source does not match the target kind" };
  return runImport({ ...parsed.data, title: parsed.data.title || undefined, dryRun, editedBy });
}
