"use server";

import { adminContext } from "@/admin/action";
import type { ActionResult } from "@/admin/result";
import { type IeltsSettingsInput, saveIeltsSettings } from "@/ielts/settings";

export async function saveIeltsSettingsAction(input: IeltsSettingsInput): Promise<ActionResult> {
  await adminContext();
  return saveIeltsSettings(input);
}
