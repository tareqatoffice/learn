// Band history: calculator results and mock bands, one row per skill set and date.

import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { IeltsBandEntry } from "@/models";
import { type ActionResult, fail, ok, type FieldErrors } from "@/admin/result";
import { isHalfBand, listeningBand, overallBand, readingBand, SKILLS, type Skill } from "@/ielts/bands";
import { suggestCurrentBand } from "@/ielts/suggestions";

export type BandSource = "official" | "practice" | "mockSelf" | "mockAi" | "other";
type Bands = Partial<Record<Skill, number>>;

export type CalculatorInput = {
  date: string;
  source: "practice" | "official" | "other";
  listeningRaw?: number;
  readingRaw?: number;
  writing?: number;
  speaking?: number;
};

export type BandEntryView = {
  id: string;
  date: string;
  source: BandSource;
  bands: Bands;
  overall?: number;
  attemptId?: string;
};

const SOURCES = ["practice", "official", "other"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRaw = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 40;
const isWritingBand = (n: unknown): n is number => typeof n === "number" && isHalfBand(n) && n >= 0 && n <= 9;

export async function saveCalculatorResult(userId: string, input: CalculatorInput, today: string): Promise<ActionResult<{ id: string }>> {
  const errors: FieldErrors = {};
  if (typeof input.date !== "string" || !DATE.test(input.date) || Number.isNaN(Date.parse(input.date))) errors.date = "Enter the date as YYYY-MM-DD.";
  else if (input.date > today) errors.date = "The date can't be in the future. Pick today or earlier.";
  if (!SOURCES.includes(input.source)) errors.source = "Choose practice, official or other.";

  const bands: Bands = {};
  if (input.listeningRaw !== undefined) {
    if (isRaw(input.listeningRaw)) bands.listening = listeningBand(input.listeningRaw);
    else errors.listeningRaw = "Listening raw score must be a whole number from 0 to 40.";
  }
  if (input.readingRaw !== undefined) {
    if (isRaw(input.readingRaw)) bands.reading = readingBand(input.readingRaw);
    else errors.readingRaw = "Reading raw score must be a whole number from 0 to 40.";
  }
  for (const k of ["writing", "speaking"] as const) {
    const v = input[k];
    if (v === undefined) continue;
    if (isWritingBand(v)) bands[k] = v;
    else errors[k] = `${k === "writing" ? "Writing" : "Speaking"} band must be from 0 to 9 in steps of 0.5.`;
  }
  if (!Object.keys(errors).length && !Object.keys(bands).length) errors._ = "Enter at least one skill.";
  if (Object.keys(errors).length) return fail(errors);

  await connectDb();
  const overall = SKILLS.every((s) => bands[s] !== undefined) ? overallBand(bands as Record<Skill, number>) : undefined;
  const doc = await IeltsBandEntry.create({ userId, date: input.date, source: input.source, bands, ...(overall !== undefined ? { overall } : {}) });
  if (input.source === "official") await suggestCurrentBand(userId, "official", { ...bands, ...(overall !== undefined ? { overall } : {}) }, today);
  return ok({ id: String(doc._id) });
}

type Row = { _id: { toString(): string }; date: string; source: BandSource; bands?: Bands; overall?: number; attemptId?: { toString(): string } };

export async function listBandEntries(userId: string, from?: string): Promise<BandEntryView[]> {
  await connectDb();
  const rows = await IeltsBandEntry.find({ userId, ...(from ? { date: { $gte: from } } : {}) })
    .sort({ date: 1, createdAt: 1 })
    .lean<Row[]>();
  return rows.map((r) => ({
    id: r._id.toString(),
    date: r.date,
    source: r.source,
    bands: Object.fromEntries(SKILLS.filter((s) => typeof r.bands?.[s] === "number").map((s) => [s, r.bands![s]])) as Bands,
    ...(typeof r.overall === "number" ? { overall: r.overall } : {}),
    ...(r.attemptId ? { attemptId: r.attemptId.toString() } : {}),
  }));
}

export async function deleteBandEntry(userId: string, id: string): Promise<ActionResult> {
  if (!isValidObjectId(id)) return fail("That entry doesn't exist. Reload the page.");
  await connectDb();
  const entry = await IeltsBandEntry.findOne({ _id: id, userId }).select("source").lean<{ source: BandSource }>();
  if (!entry) return fail("That entry doesn't exist. Reload the page.");
  if (entry.source === "mockSelf" || entry.source === "mockAi") return fail("Mock bands are removed when you delete the mock attempt.");
  await IeltsBandEntry.deleteOne({ _id: id, userId });
  return ok();
}

/** Idempotent: one row per attempt and source. */
export async function writeMockEntries(userId: string, attemptId: string, date: string, selfBand: number, aiBand?: number): Promise<void> {
  await connectDb();
  const write = (source: "mockSelf" | "mockAi", speaking: number) =>
    IeltsBandEntry.updateOne({ userId, attemptId, source }, { $set: { date, bands: { speaking } } }, { upsert: true });
  await write("mockSelf", selfBand);
  if (aiBand !== undefined) await write("mockAi", aiBand);
}
