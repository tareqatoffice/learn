"use server";

import { saveSubject, type Result, type SubjectInput } from "@/admin/service";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

export async function saveSubjectAction(input: SubjectInput): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return saveSubject(input, user.email);
}
