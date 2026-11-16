"use server";

import { adminContext } from "@/admin/action";
import { deleteSubject, saveSubject, type Result, type SubjectInput } from "@/admin/service";

export async function saveSubjectAction(input: SubjectInput): Promise<Result> {
  const user = await adminContext();
  return saveSubject(input, user.email);
}

export async function deleteSubjectAction(id: string): Promise<Result> {
  await adminContext();
  return deleteSubject(String(id));
}
