"use server";

import { z } from "zod";
import { adminContext } from "@/features/admin/action";
import { type ActionResult, ok } from "@/features/admin/result";
import { MODEL_ID_MAX, MODEL_ID_PATTERN } from "@/features/ai/lib/ai-limits";
import { type AiSettingsInput, clearAiKey, getAiConfig, saveAiKey, saveAiSettings } from "@/features/ai/lib/aiSettings";
import { type KeyCheck, type ModelCheck, checkModels } from "@/features/ai/lib/openrouter";

export async function saveAiSettingsAction(input: AiSettingsInput): Promise<ActionResult> {
  const user = await adminContext();
  return saveAiSettings(input, user.userId);
}

export async function saveAiKeyAction(
  key: string,
): Promise<ActionResult<{ verified: Exclude<KeyCheck, { status: "rejected" }> }>> {
  const user = await adminContext();
  return saveAiKey(typeof key === "string" ? key : "", user.userId);
}

export async function clearAiKeyAction(): Promise<ActionResult> {
  const user = await adminContext();
  await clearAiKey(user.userId);
  return ok();
}

export async function testAiModelsAction(models: string[]): Promise<ModelCheck[]> {
  await adminContext();
  const ids = z
    .array(z.string().trim().max(MODEL_ID_MAX).regex(MODEL_ID_PATTERN))
    .min(1)
    .max(2)
    .parse(models);
  const { apiKey } = await getAiConfig();
  return checkModels(ids, { apiKey });
}
