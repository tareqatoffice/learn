import type { Types } from "mongoose";
import { INSTRUCTIONS, JSON_SCHEMAS, SYSTEM_PROMPT, draftFromRaw, type ItemType } from "@/admin/ielts";
import { getAiConfig, modelChain } from "@/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { AiError, type ChatOptions, chatCompletion, extractJson } from "@/lib/openrouter";
import { IeltsSpeakingAttempt, IeltsSpeakingItem } from "@/models";
import { type AiResult, metered } from "@/progress/quizAi";

export type Kind = "mock" | "part1" | "part2" | "part3";
type Id = Types.ObjectId;
type Cue = { topic: string; bullets: string[]; explain: string; roundOff: string[] };
type Frame = { title: string; questions: string[] };
export type QuestionSet = {
  part1?: { itemIds: Id[]; frames: Frame[] };
  part2?: { itemId?: Id; cue: Cue };
  part3?: { itemId?: Id; questions: string[] };
};

type Item = {
  _id: Id;
  type: ItemType;
  title: string;
  aboutYou?: boolean;
  questions?: string[];
  cue?: Partial<Cue>;
  cardId?: Id;
};

const TURNED_OFF = "The AI coach is turned off.";

/** Shuffled with `rng` first, then stably ordered by last use, so never-used (empty date) comes first and ties are random. */
function leastRecent(items: Item[], lastUsed: Map<string, string>, rng: () => number): Item[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const used = (it: Item) => lastUsed.get(String(it._id)) ?? "";
  return shuffled.sort((a, b) => used(a).localeCompare(used(b)));
}

const frameOf = (it: Item): Frame => ({ title: it.title, questions: it.questions ?? [] });
const cueOf = (it: Item): Cue => ({
  topic: it.cue?.topic ?? it.title,
  bullets: it.cue?.bullets ?? [],
  explain: it.cue?.explain ?? "",
  roundOff: it.cue?.roundOff ?? [],
});

/**
 * Published items for a drill or mock, least recently used first (never-used before used; ties by `rng`).
 * `exhausted` means the bank can't give fresh material, so the UI can offer AI-written questions.
 */
export async function pickQuestions(
  userId: string,
  kind: Kind,
  rng: () => number = Math.random,
): Promise<{ questions: QuestionSet; exhausted: boolean }> {
  await connectDb();
  const [items, attempts] = await Promise.all([
    IeltsSpeakingItem.find({ status: "published" }).lean<Item[]>(),
    IeltsSpeakingAttempt.find({ userId }, { date: 1, questions: 1 }).lean<
      { date: string; questions?: { part1?: { itemIds?: Id[] }; part2?: { itemId?: Id }; part3?: { itemId?: Id } } }[]
    >(),
  ]);

  const lastUsed = new Map<string, string>();
  for (const a of attempts) {
    const ids = [...(a.questions?.part1?.itemIds ?? []), a.questions?.part2?.itemId, a.questions?.part3?.itemId];
    for (const id of ids) {
      if (!id) continue;
      const key = String(id);
      if ((lastUsed.get(key) ?? "") < a.date) lastUsed.set(key, a.date);
    }
  }

  const ofType = (type: ItemType) => items.filter((i) => i.type === type);
  const order = (list: Item[]) => leastRecent(list, lastUsed, rng);
  const questions: QuestionSet = {};
  const needed: ItemType[] = kind === "mock" ? ["part1", "part2", "part3"] : [kind];

  if (kind === "mock") {
    const p1 = ofType("part1");
    const aboutYou = order(p1.filter((i) => i.aboutYou))[0] ?? order(p1)[0];
    const others = aboutYou ? order(p1.filter((i) => i !== aboutYou)).slice(0, 2) : [];
    const frames = aboutYou ? [aboutYou, ...others] : [];
    if (frames.length) questions.part1 = { itemIds: frames.map((f) => f._id), frames: frames.map(frameOf) };

    const card = order(ofType("part2"))[0];
    if (card) questions.part2 = { itemId: card._id, cue: cueOf(card) };

    const sets = ofType("part3");
    const linked = card ? sets.filter((s) => s.cardId && String(s.cardId) === String(card._id)) : [];
    const set = order(linked)[0] ?? order(sets.filter((s) => !s.cardId))[0];
    if (set) questions.part3 = { itemId: set._id, questions: set.questions ?? [] };
  } else if (kind === "part1") {
    const it = order(ofType("part1"))[0];
    if (it) questions.part1 = { itemIds: [it._id], frames: [frameOf(it)] };
  } else if (kind === "part2") {
    const it = order(ofType("part2"))[0];
    if (it) questions.part2 = { itemId: it._id, cue: cueOf(it) };
  } else {
    const it = order(ofType("part3"))[0];
    if (it) questions.part3 = { itemId: it._id, questions: it.questions ?? [] };
  }

  const anyFresh = needed.some((type) => ofType(type).some((i) => !lastUsed.has(String(i._id))));
  const missingPart = kind === "mock" && !(questions.part1 && questions.part2 && questions.part3);
  return { questions, exhausted: !anyFresh || missingPart };
}

// ---- learner AI fill ----

type Deps = Pick<ChatOptions, "fetch">;

const MOCK_INSTRUCTIONS = [
  "Write one full Speaking test. Keys: part1 (exactly 3 frames, each with title and questions; the first frame is about the candidate themselves, e.g. home, work or studies;",
  `${INSTRUCTIONS.part1.replace(/^Write one Part 1 frame: /, "each frame is ")}),`,
  `part2 (${INSTRUCTIONS.part2.replace(/^Write one Part 2 cue card on a topic of your choice\. Keys: /, "one cue card with keys ")}),`,
  "part3 (one discussion set on the same theme as the part2 card: 5 abstract, opinion-based questions, each under 30 words; keys title and questions).",
].join(" ");

const MOCK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["part1", "part2", "part3"],
  properties: {
    part1: { type: "array", items: JSON_SCHEMAS.part1 },
    part2: JSON_SCHEMAS.part2,
    part3: JSON_SCHEMAS.part3,
  },
};

const cardBlock = (cue: Cue) =>
  `\n\nThe set follows this Part 2 cue card:\n<card>\n${cue.topic}\n${cue.bullets.map((b) => `- ${b}`).join("\n")}\n${cue.explain}\n</card>`;

/** A validated set from a model reply, or null when it doesn't fit the same bounds as admin drafts. */
function toSet(kind: Kind, reply: string): QuestionSet | null {
  const raw = extractJson(reply);
  if (kind === "mock") {
    const r = raw as { part1?: unknown; part2?: unknown; part3?: unknown } | null;
    if (!r || !Array.isArray(r.part1) || r.part1.length < 3) return null;
    const frames = r.part1.slice(0, 3).map((f) => draftFromRaw(f, "part1"));
    const card = draftFromRaw(r.part2, "part2");
    const set = draftFromRaw(r.part3, "part3");
    if (frames.some((f) => !f || f.type !== "part1") || card?.type !== "part2" || set?.type !== "part3") return null;
    return {
      part1: { itemIds: [], frames: frames.map((f) => ({ title: f!.title, questions: (f as { questions: string[] }).questions })) },
      part2: { cue: { topic: card.topic, bullets: card.bullets, explain: card.explain, roundOff: card.roundOff } },
      part3: { questions: set.questions },
    };
  }
  const item = draftFromRaw(raw, kind);
  if (!item) return null;
  if (item.type === "part1") return { part1: { itemIds: [], frames: [{ title: item.title, questions: item.questions }] } };
  if (item.type === "part2")
    return { part2: { cue: { topic: item.topic, bullets: item.bullets, explain: item.explain, roundOff: item.roundOff } } };
  return { part3: { questions: item.questions } };
}

/**
 * One metered AI call that writes questions for a learner when the bank has run out. Nothing is saved to the
 * bank; the set has no item ids. `cue` makes a Part 3 set follow that card. An unusable reply is refunded.
 */
export async function generateQuestions(
  userId: string,
  kind: Kind,
  cue?: Cue,
  deps: Deps = {},
): Promise<AiResult<QuestionSet>> {
  try {
    const { settings, apiKey } = await getAiConfig();
    if (!settings.active) return { ok: false, error: TURNED_OFF };
    const user = kind === "mock" ? MOCK_INSTRUCTIONS : kind === "part3" && cue ? INSTRUCTIONS.part3 + cardBlock(cue) : INSTRUCTIONS[kind];
    const { text } = await metered(userId, settings, () =>
      chatCompletion(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
        {
          ...deps,
          apiKey,
          models: modelChain(settings),
          maxTokens: kind === "mock" ? 2000 : 900,
          temperature: 0.9,
          jsonSchema: { name: `ielts_${kind}`, schema: kind === "mock" ? MOCK_SCHEMA : JSON_SCHEMAS[kind] },
          accept: (t) => toSet(kind, t) !== null,
        },
      ),
    );
    return { ok: true, value: toSet(kind, text)! };
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    console.error(`IELTS question generation failed for ${userId}`, error);
    return { ok: false, error: "The AI coach failed. Try again." };
  }
}
