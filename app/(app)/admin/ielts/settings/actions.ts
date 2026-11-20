"use server";

import { adminContext } from "@/features/admin/action";
import type { ActionResult } from "@/features/admin/result";
import { type IeltsSettingsInput, saveIeltsSettings } from "@/features/ielts/settings";

export async function saveIeltsSettingsAction(input: IeltsSettingsInput): Promise<ActionResult> {
  await adminContext();
  return saveIeltsSettings(input);
}
