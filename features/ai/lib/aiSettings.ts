import { z } from "zod";
import { type ActionResult, fail, ok } from "@/features/admin/result";
import { MODEL_ID_MAX, MODEL_ID_PATTERN } from "@/features/ai/lib/ai-limits";
import { getEnv } from "@/lib/env";
import { type KeyCheck, verifyKey } from "@/features/ai/lib/openrouter";
import { decryptSecret, encryptSecret } from "@/features/ai/lib/secrets";
import { AI_PROMPTS, type AiPrompts, isPromptKey, PROMPT_MAX, PROMPT_MIN, resolvePrompts } from "@/features/ai/lib/prompts";
import { AiSettings } from "@/models";

const KEY_PURPOSE = "openrouter-api-key";

export type AiKeySource = "settings" | "env" | "none";

export type AiSettingsView = {
  keyConfigured: boolean;
  keySource: AiKeySource;
  keyHint?: string;
  keyUpdatedAt?: Date;
  keyUnreadable: boolean;
  enabled: boolean;
  active: boolean;
  primaryModel: string;
  fallbackModel: string;
  visionModel: string;
  dailyLimit: number;
};

type Row = {
  enabled?: boolean;
  primaryModel?: string;
  fallbackModel?: string;
  visionModel?: string;
  dailyLimit?: number;
  apiKeyEncrypted?: string;
  apiKeyHint?: string;
  apiKeyUpdatedAt?: Date;
  prompts?: Record<string, unknown>;
};

export type AiConfig = { settings: AiSettingsView; apiKey: string; prompts: AiPrompts };

export async function getAiConfig(): Promise<AiConfig> {
  const env = getEnv();
  const row = await AiSettings.findById("ai").lean<Row>();
  const saved = row?.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted, env.AUTH_SECRET, KEY_PURPOSE) : null;
  const apiKey = saved || env.OPENROUTER_API_KEY;
  const keySource: AiKeySource = saved ? "settings" : env.OPENROUTER_API_KEY ? "env" : "none";
  const enabled = row?.enabled ?? true;
  const primaryModel = row?.primaryModel || env.OPENROUTER_MODEL;
  return {
    apiKey,
    prompts: resolvePrompts(row?.prompts),
    settings: {
      keyConfigured: Boolean(apiKey),
      keySource,
      ...(saved ? { keyHint: row?.apiKeyHint, keyUpdatedAt: row?.apiKeyUpdatedAt } : {}),
      keyUnreadable: Boolean(row?.apiKeyEncrypted) && !saved,
      enabled,
      active: Boolean(apiKey) && enabled,
      primaryModel,
      fallbackModel: row?.fallbackModel && row.fallbackModel !== primaryModel ? row.fallbackModel : "",
      visionModel: row?.visionModel ?? "",
      dailyLimit: row?.dailyLimit ?? env.OPENROUTER_DAILY_LIMIT,
    },
  };
}

export async function getAiSettings(): Promise<AiSettingsView> {
  return (await getAiConfig()).settings;
}

export const modelChain = (s: Pick<AiSettingsView, "primaryModel" | "fallbackModel">) =>
  [s.primaryModel, s.fallbackModel].filter(Boolean);

const modelId = z
  .string()
  .trim()
  .max(MODEL_ID_MAX, "Model id is too long")
  .regex(MODEL_ID_PATTERN, "Use an OpenRouter model id such as vendor/model:free");

export const aiSettingsInput = z
  .object({
    enabled: z.boolean(),
    primaryModel: modelId,
    fallbackModel: z.union([z.literal(""), modelId]),
    visionModel: z.union([z.literal(""), modelId]).optional(),
    dailyLimit: z.number({ error: "Enter a whole number" }).int("Enter a whole number").min(0).max(100_000),
  })
  .refine((s) => s.fallbackModel !== s.primaryModel, {
    path: ["fallbackModel"],
    message: "Pick a different model than the primary one",
  });

export type AiSettingsInput = z.input<typeof aiSettingsInput>;

export async function saveAiSettings(input: AiSettingsInput, userId: string): Promise<ActionResult> {
  const parsed = aiSettingsInput.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "_")] ??= issue.message;
    return fail(errors);
  }
  await AiSettings.updateOne({ _id: "ai" }, { $set: { ...parsed.data, updatedBy: userId } }, { upsert: true });
  return ok();
}

export const API_KEY_MAX = 300;
const apiKeyInput = z
  .string()
  .trim()
  .min(10, "That does not look like an OpenRouter key")
  .max(API_KEY_MAX, "That does not look like an OpenRouter key")
  .regex(/^\S+$/, "Keys contain no spaces");

export type SaveKeyResult = ActionResult<{ verified: Exclude<KeyCheck, { status: "rejected" }> }>;

export async function saveAiKey(
  key: string,
  userId: string,
  options: { fetch?: typeof fetch } = {},
): Promise<SaveKeyResult> {
  const parsed = apiKeyInput.safeParse(key);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const secret = getEnv().AUTH_SECRET;
  if (!secret) return fail("Set AUTH_SECRET first: saved keys are encrypted with it.");

  const verified = await verifyKey(parsed.data, options);
  if (verified.status === "rejected") return fail("OpenRouter rejected this key. Check it and try again.");

  await AiSettings.updateOne(
    { _id: "ai" },
    {
      $set: {
        apiKeyEncrypted: encryptSecret(parsed.data, secret, KEY_PURPOSE),
        apiKeyHint: parsed.data.slice(-4),
        apiKeyUpdatedAt: new Date(),
        updatedBy: userId,
      },
    },
    { upsert: true },
  );
  return ok({ verified });
}

const promptText = z
  .string()
  .trim()
  .min(PROMPT_MIN, `Write at least ${PROMPT_MIN} characters, or reset to the default`)
  .max(PROMPT_MAX, `Keep it under ${PROMPT_MAX} characters`);

export async function savePrompt(key: string, text: string, userId: string): Promise<ActionResult> {
  if (!isPromptKey(key)) return fail("Unknown prompt.");
  const parsed = promptText.safeParse(text);
  if (!parsed.success) return fail({ text: parsed.error.issues[0].message });
  if (parsed.data === AI_PROMPTS[key].default) return resetPrompt(key, userId);
  await AiSettings.updateOne({ _id: "ai" }, { $set: { [`prompts.${key}`]: parsed.data, updatedBy: userId } }, { upsert: true });
  return ok();
}

export async function resetPrompt(key: string, userId: string): Promise<ActionResult> {
  if (!isPromptKey(key)) return fail("Unknown prompt.");
  await AiSettings.updateOne({ _id: "ai" }, { $unset: { [`prompts.${key}`]: 1 }, $set: { updatedBy: userId } });
  return ok();
}

export async function clearAiKey(userId: string): Promise<void> {
  await AiSettings.updateOne(
    { _id: "ai" },
    { $unset: { apiKeyEncrypted: 1, apiKeyHint: 1, apiKeyUpdatedAt: 1 }, $set: { updatedBy: userId } },
  );
}
