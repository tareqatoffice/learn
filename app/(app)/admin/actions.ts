"use server";

import { moveItem, setStatus, type OrderedKind, type Result, type StatusKind } from "@/admin/service";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import type { Status } from "@/models";

export async function moveItemAction(kind: OrderedKind, id: string, dir: "up" | "down"): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return moveItem(kind, id, dir, user.email);
}

export async function setStatusAction(kind: StatusKind, id: string, status: Status): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return setStatus(kind, id, status, user.email);
}
