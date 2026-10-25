"use server";

import type { Result } from "@/admin/service";
import { setUserAccess } from "@/admin/users";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

export async function setUserAccessAction(
  id: string,
  status: "approved" | "blocked",
  reason?: string,
): Promise<Result> {
  const admin = await requireAdmin();
  await connectDb();
  return setUserAccess({ id, status, reason }, admin.email);
}
