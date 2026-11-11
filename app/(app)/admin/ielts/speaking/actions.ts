"use server";

import { adminContext } from "@/admin/action";
import { createItem, deleteItem, generateItemDraft, setItemStatus, updateItem, type ItemInput, type ItemStatus, type ItemType } from "@/admin/ielts";
import type { ActionResult } from "@/admin/result";

export async function createItemAction(input: ItemInput) {
  await adminContext();
  return createItem(input);
}

export async function updateItemAction(id: string, input: ItemInput): Promise<ActionResult> {
  await adminContext();
  return updateItem(id, input);
}

export async function deleteItemAction(id: string): Promise<ActionResult> {
  await adminContext();
  return deleteItem(id);
}

export async function setItemStatusAction(id: string, status: ItemStatus): Promise<ActionResult> {
  await adminContext();
  return setItemStatus(id, status);
}

export async function generateItemDraftAction(type: ItemType, cardId?: string): Promise<ActionResult<{ id: string }>> {
  const user = await adminContext();
  return generateItemDraft(user.userId, type, cardId);
}
