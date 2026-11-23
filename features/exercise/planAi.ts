import { getAiConfig, modelChain } from "@/features/ai/lib/aiSettings";
import { systemPrompt } from "@/features/ai/lib/prompts";
import { chatCompletion, extractJson } from "@/features/ai/lib/openrouter";
import { metered } from "@/features/progress/quizAi";
import type { Feel } from "@/models/exerciseConstants";
import { allowedFor, type Exercise } from "./catalog";
import { fillDay, slotsFor, validateDay, type PlanDay, type SkeletonDay } from "./plan";

export type LastWeekResult = { exerciseId: string; setsDone: number; skipped: boolean; feel?: Feel };
export type FillWeekInput = {
  userId: string;
  skeleton: SkeletonDay[];
  weekIdx: number;
  profileSummary: string;
  lastWeek: LastWeekResult[];
  /** Active exercises the plan may use. */
  exercises: readonly Exercise[];
  fetch?: typeof fetch;
};
export type FillWeekResult = { days: PlanDay[]; source: "ai" | "code"; coachNote: string };

const NOTE_MAX = 600;
const TIMEOUT_MS = 20000;

export function codeNote(p: { weekIdx: number; deload: boolean; workouts: number }): string {
  const lead = p.deload ? "lighter week to recover" : "steady progress";
  return `Week ${p.weekIdx + 1}: ${lead}. ${p.workouts} workout${p.workouts === 1 ? "" : "s"}.`;
}

const SCHEMA = {
  type: "object",
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                exerciseId: { type: "string" },
                sets: { type: "integer" },
                reps: { type: "integer" },
                seconds: { type: "integer" },
                restSec: { type: "integer" },
              },
              required: ["exerciseId", "sets", "restSec"],
              additionalProperties: false,
            },
          },
        },
        required: ["date", "items"],
        additionalProperties: false,
      },
    },
    coachNote: { type: "string" },
  },
  required: ["days", "coachNote"],
  additionalProperties: false,
};

const PLAN_FORMAT =
  'Reply with JSON only: {"days":[{"date","items":[{"exerciseId","sets","reps" or "seconds","restSec"}]}],"coachNote"}.';

function buildPrompt(input: FillWeekInput): string {
  const days = input.skeleton.map((d) => {
    const allowed = allowedFor(input.exercises, d.focus, d.maxDifficulty)
      .map((e) => `${e.id} (${e.name}, ${e.mode})`)
      .join("; ");
    return (
      `Date ${d.date}: focus ${d.focus}, ${d.minutes} min, ${slotsFor(d, input.exercises)} slots, ${d.sets} sets, rest ${d.restSec}s, ` +
      `${d.reps} reps, ${d.seconds} seconds. Allowed: ${allowed}`
    );
  });
  const last = input.lastWeek.length
    ? input.lastWeek
        .map((r) => `${r.exerciseId}: ${r.skipped ? "skipped" : `${r.setsDone} sets`}${r.feel ? `, felt ${r.feel}` : ""}`)
        .join("; ")
    : "none";
  return [`Profile: ${input.profileSummary}`, `Week ${input.weekIdx + 1}.`, ...days, `Last week: ${last}`].join("\n");
}

export async function fillWeek(input: FillWeekInput): Promise<FillWeekResult> {
  const { userId, skeleton, weekIdx } = input;
  const note = codeNote({ weekIdx, deload: (weekIdx + 1) % 4 === 0, workouts: skeleton.length });
  const byCode = (): FillWeekResult => ({
    days: skeleton.map((d) => fillDay(d, userId + d.date, input.exercises)),
    source: "code",
    coachNote: note,
  });
  if (!skeleton.length) return { days: [], source: "code", coachNote: note };

  try {
    const { settings, apiKey, prompts } = await getAiConfig();
    if (!settings.active) return byCode();
    const { text } = await metered(userId, settings, () =>
      chatCompletion(
        [
          { role: "system", content: systemPrompt(prompts.exercisePlan, PLAN_FORMAT) },
          { role: "user", content: buildPrompt(input) },
        ],
        {
          apiKey,
          models: modelChain(settings),
          maxTokens: 1500,
          temperature: 0.4,
          jsonSchema: { name: "week_plan", schema: SCHEMA },
          timeoutMs: TIMEOUT_MS,
          fetch: input.fetch,
        },
      ),
    );
    const parsed = extractJson(text) as { days?: unknown; coachNote?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.days)) return byCode();
    const byDate = new Map<string, unknown>();
    for (const d of parsed.days as { date?: unknown; items?: unknown }[]) {
      if (d && typeof d.date === "string") byDate.set(d.date, d.items);
    }
    let fromAi = 0;
    const days = skeleton.map((day): PlanDay => {
      const items = validateDay(day, byDate.get(day.date), input.exercises);
      if (!items) return fillDay(day, userId + day.date, input.exercises);
      fromAi++;
      return { date: day.date, focus: day.focus, minutes: day.minutes, items };
    });
    if (!fromAi) return byCode();
    const coachNote = typeof parsed.coachNote === "string" ? parsed.coachNote.trim().slice(0, NOTE_MAX) : "";
    return { days, source: "ai", coachNote: coachNote || note };
  } catch {
    return byCode();
  }
}
