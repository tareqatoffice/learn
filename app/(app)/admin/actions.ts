"use server";

import { adminContext } from "@/features/admin/action";
import {
  moveItem,
  setStatus,
  type OrderedKind,
  type Result,
  type StatusKind,
} from "@/features/admin/service";
import type { Status } from "@/models";

export async function moveItemAction(
  kind: OrderedKind,
  id: string,
  dir: "up" | "down",
): Promise<Result> {
  await adminContext();
  return moveItem(kind, id, dir);
}

export async function setStatusAction(
  kind: StatusKind,
  id: string,
  status: Status,
): Promise<Result> {
  const user = await adminContext();
  return setStatus(kind, id, status, user.email);
}
