import { z } from "zod";
import { type ActionResult, fail, ok } from "@/features/admin/result";
import { FOCUS_PRESETS_MAX, ROTATION_FOCUSES, ROTATION_MAX } from "@/lib/appSettings";
import { connectDb } from "@/lib/db";
import { AppSettings } from "@/models";
import { FOCUS_MAX_TARGET_MINUTES } from "@/models/focusConstants";

const minutes = z
  .number({ error: "Enter whole minutes" })
  .int("Enter whole minutes")
  .min(1, "At least 1 minute")
  .max(FOCUS_MAX_TARGET_MINUTES, `At most ${FOCUS_MAX_TARGET_MINUTES} minutes`);

const appSettingsInput = z.object({
  focusPresets: z
    .array(minutes)
    .min(1, "Keep at least one preset")
    .max(FOCUS_PRESETS_MAX, `Up to ${FOCUS_PRESETS_MAX} presets`)
    .refine((a) => new Set(a).size === a.length, "Each preset must be different")
    .transform((a) => [...a].sort((x, y) => x - y)),
  exerciseRotation: z
    .array(z.enum(ROTATION_FOCUSES as [string, ...string[]], { error: "Pick a workout focus" }))
    .min(1, "Keep at least one focus")
    .max(ROTATION_MAX, `Up to ${ROTATION_MAX} focuses`),
});

export type AppSettingsInput = z.input<typeof appSettingsInput>;

export async function saveAppSettings(input: AppSettingsInput): Promise<ActionResult> {
  const parsed = appSettingsInput.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "_")] ??= issue.message;
    return fail(errors);
  }
  await connectDb();
  await AppSettings.updateOne({ key: "default" }, { $set: parsed.data }, { upsert: true });
  return ok();
}
