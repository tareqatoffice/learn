"use server";

import { adminContext } from "@/features/admin/action";
import { restoreRevisionChecked, type Result } from "@/features/admin/service";

export async function restoreRevisionAction(
  revisionId: string,
): Promise<Result> {
  const user = await adminContext();
  return restoreRevisionChecked(String(revisionId), user.email);
}
