"use server";

import { adminContext } from "@/features/admin/action";
import { type AppSettingsInput, saveAppSettings } from "@/features/admin/appSettings";
import type { ActionResult } from "@/features/admin/result";

export async function saveAppSettingsAction(input: AppSettingsInput): Promise<ActionResult> {
  await adminContext();
  return saveAppSettings(input);
}
