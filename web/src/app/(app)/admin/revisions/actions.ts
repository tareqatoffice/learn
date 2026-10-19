"use server";

import { isValidObjectId } from "mongoose";
import type { Result } from "@/admin/service";
import { restoreRevision } from "@/content/revisions";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Revision } from "@/models";

/** Re-applies a stored snapshot; the restore itself becomes a new revision. */
export async function restoreRevisionAction(revisionId: string): Promise<Result> {
  const user = await requireAdmin();
  if (!isValidObjectId(revisionId)) return { ok: false, errors: { _: "Invalid revision" } };
  await connectDb();
  const revision = await Revision.findById(revisionId, { entityId: 1 }).lean<{ entityId: unknown }>();
  if (!revision) return { ok: false, errors: { _: "Revision not found" } };
  try {
    await restoreRevision(revisionId, user.email);
  } catch (error) {
    return { ok: false, errors: { _: error instanceof Error ? error.message : "Restore failed" } };
  }
  return { ok: true, id: String(revision.entityId) };
}
