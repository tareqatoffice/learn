"use server";

import { adminContext } from "@/admin/action";
import { restoreRevisionChecked, type Result } from "@/admin/service";

export async function restoreRevisionAction(
  revisionId: string,
): Promise<Result> {
  const user = await adminContext();
  return restoreRevisionChecked(String(revisionId), user.email);
}
