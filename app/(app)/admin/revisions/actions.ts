"use server";

import { restoreRevisionChecked, type Result } from "@/admin/service";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

/** Re-applies a stored snapshot if it still fits the editors' rules; the restore itself becomes a new revision. */
export async function restoreRevisionAction(
  revisionId: string,
): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return restoreRevisionChecked(String(revisionId), user.email);
}
