import { z } from "zod";
import { connectDb } from "@/lib/db";
import { issuesMessage } from "@/lib/zod";
import { IeltsSettings } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";

export type IeltsSettingsView = {
  hoursPerBand: number;
  split: { foundation: number; skills: number; mocks: number };
  thresholds: {
    missedShare: number;
    missedStreak: number;
    weakGap: number;
    shiftShare: number;
    currentBandGap: number;
    dismissDays: number;
  };
};

export const DEFAULT_IELTS_SETTINGS: IeltsSettingsView = {
  hoursPerBand: 200,
  split: { foundation: 30, skills: 45, mocks: 25 },
  thresholds: { missedShare: 0.6, missedStreak: 3, weakGap: 1, shiftShare: 0.15, currentBandGap: 0.5, dismissDays: 7 },
};

const pct = z.number().min(0).max(100);

const settingsInput = z.object({
  hoursPerBand: z.number().positive().max(1000),
  split: z
    .object({ foundation: pct, skills: pct, mocks: pct })
    .refine((s) => Math.abs(s.foundation + s.skills + s.mocks - 100) < 1e-9, "The split must add up to 100."),
  thresholds: z
    .object({
      missedShare: z.number().min(0).max(1),
      missedStreak: z.number().int().min(1).max(30),
      weakGap: z.number().min(0).max(8),
      shiftShare: z.number().min(0).max(1),
      currentBandGap: z.number().min(0).max(8),
      dismissDays: z.number().int().min(0).max(365),
    })
    .partial()
    .optional(),
});

export type IeltsSettingsInput = z.input<typeof settingsInput>;

export async function getIeltsSettings(): Promise<IeltsSettingsView> {
  await connectDb();
  const doc = await IeltsSettings.findOne({ key: "default" }).lean<Partial<IeltsSettingsView>>();
  const d = DEFAULT_IELTS_SETTINGS;
  return {
    hoursPerBand: doc?.hoursPerBand ?? d.hoursPerBand,
    split: { ...d.split, ...doc?.split },
    thresholds: { ...d.thresholds, ...doc?.thresholds },
  };
}

export async function saveIeltsSettings(input: IeltsSettingsInput): Promise<ActionResult> {
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) return fail(issuesMessage(parsed.error));
  const { hoursPerBand, split, thresholds } = parsed.data;
  const $set: Record<string, unknown> = { hoursPerBand, split };
  for (const [k, v] of Object.entries(thresholds ?? {})) if (v !== undefined) $set[`thresholds.${k}`] = v;
  await connectDb();
  await IeltsSettings.updateOne({ key: "default" }, { $set }, { upsert: true });
  return ok();
}
