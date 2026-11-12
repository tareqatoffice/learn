// Admin service for IELTS Reading and Listening tests and Writing prompts.
// Questions are authored as text (see ielts/practice/format.ts) and stored as structured groups.

import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { z } from "zod";
import { type ActionResult, fail, ok, type FieldErrors } from "@/admin/result";
import { formatQuestions, parseQuestions } from "@/ielts/practice/format";
import { numberSections, type Section } from "@/ielts/practice/marking";
import { getAiConfig, modelChain } from "@/lib/aiSettings";
import { AUDIO_EXT } from "@/lib/audioTypes";
import { connectDb } from "@/lib/db";
import { AiError, type ChatOptions, chatCompletion, extractJson } from "@/lib/openrouter";
import { deleteObjects, headObject, presignPut, storageConfigured } from "@/lib/r2";
import { IeltsListeningTest, IeltsReadingTest, IeltsWritingPrompt } from "@/models";
import { SAFETY, metered } from "@/progress/quizAi";

export type TestKind = "reading" | "listening";
export type PublishStatus = "draft" | "published";

const isId = (id: unknown): id is string => typeof id === "string" && Types.ObjectId.isValid(id);
const NOT_FOUND = "That item no longer exists.";
const NO_STORAGE = "File storage isn't configured. Set the R2_* environment variables.";
const AUDIO_MAX_BYTES = 80 * 1024 * 1024;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const NEEDS_IMAGE = "Upload the chart image before publishing a Task 1 prompt. Save it as a draft first.";
const model = (kind: TestKind) => (kind === "reading" ? IeltsReadingTest : IeltsListeningTest);

// ---- tests ----

export type TestInput = {
  title: string;
  status: PublishStatus;
  /** `audioKey` is the file the section already has; it travels with the section, not its position. */
  sections: { title: string; passage?: string; script?: string; questions: string; audioKey?: string }[];
};

export type AdminTest = {
  id: string;
  kind: TestKind;
  title: string;
  status: PublishStatus;
  generated: boolean;
  sections: { title: string; passage: string; script: string; audioKey: string; durationSec: number; questions: string; count: number }[];
};

type TestRow = { _id: Types.ObjectId; title: string; status?: PublishStatus; generated?: boolean; sections: Section[] };

const countOf = (s: Section) => s.groups.reduce((n, g) => n + g.questions.length, 0);

const toAdmin = (kind: TestKind, d: TestRow): AdminTest => ({
  id: String(d._id),
  kind,
  title: d.title,
  status: d.status ?? "draft",
  generated: d.generated ?? false,
  sections: d.sections.map((s) => ({
    title: s.title,
    passage: s.passage ?? "",
    script: s.script ?? "",
    audioKey: s.audioKey ?? "",
    durationSec: s.durationSec ?? 0,
    questions: formatQuestions(s.groups),
    count: countOf(s),
  })),
});

/** Validates the input and builds the stored sections; audio is kept from `previous` by position. */
function build(kind: TestKind, input: TestInput, previous: Section[] = []): { sections: Section[] } | { errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (typeof input?.title !== "string" || !input.title.trim()) errors.title = "Give the test a title.";
  if (!Array.isArray(input?.sections) || !input.sections.length) errors.sections = "Add at least one section.";
  else if (input.sections.length > (kind === "reading" ? 3 : 4)) errors.sections = `A ${kind} test has at most ${kind === "reading" ? 3 : 4} sections.`;
  const sections: Section[] = [];
  // Audio follows the file the form sends back, never the section's position, so removing or
  // reordering sections can't attach a recording to the wrong questions.
  const known = new Map(previous.filter((p) => p.audioKey).map((p) => [p.audioKey, p.durationSec ?? 0]));
  (input?.sections ?? []).forEach((s, i) => {
    if (!s.title?.trim()) errors[`sections.${i}.title`] = "Give the section a title.";
    if (kind === "reading" && !s.passage?.trim()) errors[`sections.${i}.passage`] = "Paste the passage.";
    const parsed = parseQuestions(s.questions ?? "");
    if (!parsed.ok) errors[`sections.${i}.questions`] = parsed.errors.slice(0, 5).join(" ");
    else {
      const audioKey = kind === "listening" && s.audioKey && known.has(s.audioKey) ? s.audioKey : "";
      sections.push({
        title: (s.title ?? "").trim(),
        passage: kind === "reading" ? (s.passage ?? "").trim() : "",
        script: kind === "listening" ? (s.script ?? "").trim() : "",
        audioKey,
        durationSec: audioKey ? (known.get(audioKey) ?? 0) : 0,
        groups: parsed.groups,
      });
    }
  });
  if (Object.keys(errors).length) return { errors };
  numberSections(sections);
  return { sections };
}

export async function saveTest(kind: TestKind, id: string | null, input: TestInput, extra: { generated?: boolean } = {}): Promise<ActionResult<{ id: string }>> {
  if (kind !== "reading" && kind !== "listening") return fail("Unknown test type.");
  await connectDb();
  let previous: Section[] = [];
  if (id) {
    if (!isId(id)) return fail(NOT_FOUND);
    const existing = await model(kind).findById(id).lean<TestRow>();
    if (!existing) return fail(NOT_FOUND);
    previous = existing.sections;
  }
  if (input?.status !== "draft" && input?.status !== "published") return fail({ status: "Choose draft or published." });
  const built = build(kind, input, previous);
  if ("errors" in built) return fail(built.errors);
  if (input.status === "published") {
    const problem = publishProblem(kind, built.sections);
    if (problem) return fail({ status: problem });
  }
  const data = { title: input.title.trim(), status: input.status, sections: built.sections };
  if (id) {
    await model(kind).updateOne({ _id: id }, { $set: data });
    // Recordings no section references any more.
    const kept = new Set(built.sections.map((s) => s.audioKey));
    const dropped = previous.map((s) => s.audioKey).filter((k) => k && !kept.has(k));
    if (dropped.length) await removeFiles(dropped);
    return ok({ id });
  }
  const doc = await model(kind).create({ ...data, generated: extra.generated ?? false });
  return ok({ id: String(doc._id) });
}

async function removeFiles(keys: string[]): Promise<void> {
  if (!keys.length || !storageConfigured()) return;
  try {
    await deleteObjects(keys);
  } catch {
    // Orphaned files are harmless.
  }
}

/** Why a test can't be published, or null: learners must be able to answer every section. */
function publishProblem(kind: TestKind, sections: Section[]): string | null {
  if (!sections.some((s) => countOf(s) > 0)) return "Add questions before publishing.";
  if (kind === "listening") {
    const silent = sections.findIndex((s) => !s.audioKey && !s.script?.trim());
    if (silent !== -1) return `Section ${silent + 1} has no audio file and no script. Upload audio or add a script before publishing.`;
  }
  return null;
}

export async function deleteTest(kind: TestKind, id: string): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  await connectDb();
  const doc = await model(kind).findByIdAndDelete(id).lean<TestRow>();
  if (!doc) return fail(NOT_FOUND);
  await removeFiles(doc.sections.map((s) => s.audioKey).filter(Boolean));
  return ok();
}

export async function setTestStatus(kind: TestKind, id: string, status: PublishStatus): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  if (status !== "draft" && status !== "published") return fail("Choose draft or published.");
  await connectDb();
  const doc = await model(kind).findById(id).lean<TestRow>();
  if (!doc) return fail(NOT_FOUND);
  if (status === "published") {
    const problem = publishProblem(kind, doc.sections);
    if (problem) return fail(problem);
  }
  await model(kind).updateOne({ _id: id }, { $set: { status } });
  return ok();
}

export async function listTestsAdmin(kind: TestKind): Promise<AdminTest[]> {
  await connectDb();
  const rows = await model(kind).find({}).sort({ title: 1, _id: 1 }).lean<TestRow[]>();
  return rows.map((r) => toAdmin(kind, r));
}

export async function getTestAdmin(kind: TestKind, id: string): Promise<AdminTest | null> {
  if (!isId(id)) return null;
  await connectDb();
  const doc = await model(kind).findById(id).lean<TestRow>();
  return doc ? toAdmin(kind, doc) : null;
}

// ---- Listening audio ----

export async function startSectionAudioUpload(id: string, index: number, mime: string, size: number): Promise<ActionResult<{ uploadUrl: string; key: string }>> {
  if (!isId(id) || !Number.isInteger(index) || index < 0) return fail(NOT_FOUND);
  const type = String(mime).split(";")[0].trim().toLowerCase();
  if (!type.startsWith("audio/")) return fail("Choose an audio file.");
  if (!Number.isFinite(size) || size <= 0) return fail("That file is empty.");
  if (size > AUDIO_MAX_BYTES) return fail("Audio can be 80 MB at most.");
  if (!storageConfigured()) return fail(NO_STORAGE);
  await connectDb();
  const test = await IeltsListeningTest.findById(id).select("sections").lean<TestRow>();
  if (!test?.sections[index]) return fail("Save the section before adding audio.");
  const key = `ielts/tests/listening/${id}/${randomBytes(12).toString("hex")}.${AUDIO_EXT[type] ?? "audio"}`;
  return ok({ uploadUrl: await presignPut(key, type, size), key });
}

export async function confirmSectionAudio(id: string, index: number, key: string, durationSec: number): Promise<ActionResult> {
  if (!isId(id) || !Number.isInteger(index) || index < 0) return fail(NOT_FOUND);
  if (typeof key !== "string" || !key.startsWith(`ielts/tests/listening/${id}/`) || key.includes("..") || key.length > 200) {
    return fail("That upload doesn't belong to this test.");
  }
  if (!storageConfigured()) return fail(NO_STORAGE);
  await connectDb();
  const test = await IeltsListeningTest.findById(id).select("sections").lean<TestRow>();
  if (!test?.sections[index]) return fail(NOT_FOUND);
  const head = await headObject(key);
  if (!head) return fail("The audio didn't finish uploading. Try again.");
  if (head.size > AUDIO_MAX_BYTES) {
    await removeFiles([key]);
    return fail("Audio can be 80 MB at most.");
  }
  const duration = Number.isFinite(durationSec) ? Math.min(Math.max(Math.round(durationSec), 0), 3600) : 0;
  await IeltsListeningTest.updateOne({ _id: id }, { $set: { [`sections.${index}.audioKey`]: key, [`sections.${index}.durationSec`]: duration } });
  const previous = test.sections[index].audioKey;
  if (previous && previous !== key) await removeFiles([previous]);
  return ok();
}

// ---- Writing prompts ----

export type PromptInput = { task: "task1" | "task2"; title: string; brief: string; imageAlt?: string; status: PublishStatus; tags?: string[] };
export type AdminPrompt = PromptInput & { id: string; imageKey: string; imageAlt: string; tags: string[]; generated: boolean };

const promptInput = z.object({
  task: z.enum(["task1", "task2"]),
  title: z.string().trim().min(1, "Give the prompt a title.").max(200),
  brief: z.string().trim().min(10, "Write the task instruction.").max(3000),
  imageAlt: z.string().trim().max(1000).default(""),
  status: z.enum(["draft", "published"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

function parsePrompt(input: unknown) {
  const parsed = promptInput.safeParse(input);
  if (parsed.success) return { data: parsed.data, errors: null };
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "_")] ??= issue.message;
  return { data: null, errors };
}

type PromptRow = {
  _id: Types.ObjectId; task: "task1" | "task2"; title: string; brief: string; imageKey?: string; imageAlt?: string;
  status?: PublishStatus; tags?: string[]; generated?: boolean;
};
const toPrompt = (d: PromptRow): AdminPrompt => ({
  id: String(d._id), task: d.task, title: d.title, brief: d.brief, imageKey: d.imageKey ?? "", imageAlt: d.imageAlt ?? "",
  status: d.status ?? "draft", tags: d.tags ?? [], generated: d.generated ?? false,
});

export async function savePrompt(id: string | null, input: unknown, extra: { generated?: boolean } = {}): Promise<ActionResult<{ id: string }>> {
  const { data, errors } = parsePrompt(input);
  if (!data) return fail(errors);
  await connectDb();
  if (id) {
    if (!isId(id)) return fail(NOT_FOUND);
    const existing = await IeltsWritingPrompt.findById(id).select("task imageKey").lean<{ task: string; imageKey?: string }>();
    if (!existing) return fail(NOT_FOUND);
    if (existing.task !== data.task) return fail("A prompt's task can't be changed. Create a new prompt instead.");
    if (data.status === "published" && data.task === "task1" && !existing.imageKey) return fail({ status: NEEDS_IMAGE });
    await IeltsWritingPrompt.updateOne({ _id: id }, { $set: { title: data.title, brief: data.brief, imageAlt: data.imageAlt, status: data.status, tags: data.tags } });
    return ok({ id });
  }
  // A new Task 1 prompt has no image yet (it is uploaded after the first save).
  if (data.status === "published" && data.task === "task1") return fail({ status: NEEDS_IMAGE });
  const doc = await IeltsWritingPrompt.create({ ...data, generated: extra.generated ?? false });
  return ok({ id: String(doc._id) });
}

export async function deletePrompt(id: string): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  await connectDb();
  const doc = await IeltsWritingPrompt.findByIdAndDelete(id).lean<PromptRow>();
  if (!doc) return fail(NOT_FOUND);
  if (doc.imageKey) await removeFiles([doc.imageKey]);
  return ok();
}

export async function setPromptStatus(id: string, status: PublishStatus): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  if (status !== "draft" && status !== "published") return fail("Choose draft or published.");
  await connectDb();
  const p = await IeltsWritingPrompt.findById(id).select("task imageKey").lean<{ task: string; imageKey?: string }>();
  if (!p) return fail(NOT_FOUND);
  if (status === "published" && p.task === "task1" && !p.imageKey) return fail(NEEDS_IMAGE);
  await IeltsWritingPrompt.updateOne({ _id: id }, { $set: { status } });
  return ok();
}

export async function listPromptsAdmin(): Promise<AdminPrompt[]> {
  await connectDb();
  return (await IeltsWritingPrompt.find({}).sort({ task: 1, title: 1, _id: 1 }).lean<PromptRow[]>()).map(toPrompt);
}

export async function getPromptAdmin(id: string): Promise<AdminPrompt | null> {
  if (!isId(id)) return null;
  await connectDb();
  const doc = await IeltsWritingPrompt.findById(id).lean<PromptRow>();
  return doc ? toPrompt(doc) : null;
}

const IMAGE_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export async function startPromptImageUpload(id: string, mime: string, size: number): Promise<ActionResult<{ uploadUrl: string; key: string }>> {
  if (!isId(id)) return fail(NOT_FOUND);
  const type = String(mime).split(";")[0].trim().toLowerCase();
  if (!IMAGE_EXT[type]) return fail("Choose a PNG, JPEG, WebP or GIF image.");
  if (!Number.isFinite(size) || size <= 0) return fail("That file is empty.");
  if (size > IMAGE_MAX_BYTES) return fail("The image can be 5 MB at most.");
  if (!storageConfigured()) return fail(NO_STORAGE);
  await connectDb();
  const p = await IeltsWritingPrompt.findById(id).select("task").lean<{ task: string }>();
  if (!p) return fail(NOT_FOUND);
  if (p.task !== "task1") return fail("Only Task 1 prompts have an image.");
  const key = `ielts/tests/writing/${id}/${randomBytes(12).toString("hex")}.${IMAGE_EXT[type]}`;
  return ok({ uploadUrl: await presignPut(key, type, size), key });
}

export async function confirmPromptImage(id: string, key: string): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  if (typeof key !== "string" || !key.startsWith(`ielts/tests/writing/${id}/`) || key.includes("..") || key.length > 200) {
    return fail("That upload doesn't belong to this prompt.");
  }
  if (!storageConfigured()) return fail(NO_STORAGE);
  await connectDb();
  const p = await IeltsWritingPrompt.findById(id).select("imageKey").lean<{ imageKey?: string }>();
  if (!p) return fail(NOT_FOUND);
  const head = await headObject(key);
  if (!head) return fail("The image didn't finish uploading. Try again.");
  if (head.size > IMAGE_MAX_BYTES) {
    await removeFiles([key]);
    return fail("The image can be 5 MB at most.");
  }
  await IeltsWritingPrompt.updateOne({ _id: id }, { $set: { imageKey: key } });
  if (p.imageKey && p.imageKey !== key) await removeFiles([p.imageKey]);
  return ok();
}

// ---- AI drafts (always saved as drafts) ----

type Deps = Pick<ChatOptions, "fetch">;
const TURNED_OFF = "The AI coach is turned off.";
const DRAFT_SAFETY = SAFETY + " Reply with only a JSON object.";

const draftSchema = (props: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });

const FORMAT_HELP = [
  "Write the questions in this plain-text format. A group starts with `## kind | instruction` where kind is tfng, ynng, mcq, matching or completion.",
  "Each question is one line `question => answer ~ optional explanation`. tfng answers are TRUE/FALSE/NOT GIVEN; ynng are YES/NO/NOT GIVEN.",
  "For mcq, put indented option lines `  A. text` under the question and answer with the letter.",
  "For matching, put shared options as `> A. text` lines after the header and answer with the letter.",
  "For completion, use ___ in the question and list accepted answers separated by |.",
].join(" ");

async function aiJson<T>(adminUserId: string, system: string, user: string, name: string, schema: Record<string, unknown>, parse: (reply: string) => T | null, deps: Deps): Promise<{ ok: true; value: T } | { ok: false; errors: FieldErrors }> {
  try {
    const { settings, apiKey } = await getAiConfig();
    if (!settings.active) return fail(TURNED_OFF);
    const { text } = await metered(adminUserId, settings, () =>
      chatCompletion(
        [{ role: "system", content: system }, { role: "user", content: user }],
        { ...deps, apiKey, models: modelChain(settings), maxTokens: 3500, temperature: 0.8, jsonSchema: { name, schema }, accept: (t) => parse(t) !== null },
      ),
    );
    return { ok: true, value: parse(text)! };
  } catch (error) {
    if (error instanceof AiError) return fail(error.message);
    console.error(`IELTS draft generation failed for ${adminUserId}`, error);
    return fail("The AI coach failed. Try again.");
  }
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseTestDraft(kind: TestKind, reply: string): TestInput | null {
  const raw = extractJson(reply) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return null;
  const input: TestInput = {
    title: s(raw.title, 200),
    status: "draft",
    sections: [{ title: s(raw.sectionTitle, 200) || s(raw.title, 200), ...(kind === "reading" ? { passage: s(raw.text, 12000) } : { script: s(raw.text, 12000) }), questions: s(raw.questions, 12000) }],
  };
  return "errors" in build(kind, input) ? null : input;
}

/** One metered call: a one-section Reading passage or Listening script with questions, saved as a draft. */
export async function generateTestDraft(adminUserId: string, kind: TestKind, deps: Deps = {}): Promise<ActionResult<{ id: string }>> {
  if (kind !== "reading" && kind !== "listening") return fail("Unknown test type.");
  const system = `You write IELTS Academic ${kind} practice material in the style of the real test. ${FORMAT_HELP} ${DRAFT_SAFETY}`;
  const user =
    kind === "reading"
      ? "Write one Reading passage of about 700 words on an academic topic, with 13 questions: a tfng group of 5, a completion group of 4 and an mcq group of 4. Keys: title, sectionTitle, text (the passage), questions."
      : "Write the script of one Listening monologue or conversation of about 450 words (everyday or academic setting), with 10 questions: a completion group of 5 and an mcq group of 5. Keys: title, sectionTitle, text (the script), questions.";
  const res = await aiJson(
    adminUserId, system, user, `ielts_${kind}_draft`,
    draftSchema({ title: { type: "string" }, sectionTitle: { type: "string" }, text: { type: "string" }, questions: { type: "string" } }),
    (r) => parseTestDraft(kind, r), deps,
  );
  if (!res.ok) return res;
  return saveTest(kind, null, res.value, { generated: true });
}

export function parsePromptDraft(task: "task1" | "task2", reply: string): PromptInput | null {
  const raw = extractJson(reply) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return null;
  const candidate = { task, title: s(raw.title, 200), brief: s(raw.brief, 3000), imageAlt: task === "task1" ? s(raw.chartDescription, 1000) : "", status: "draft", tags: [] };
  const parsed = promptInput.safeParse(candidate);
  return parsed.success ? (parsed.data as PromptInput) : null;
}

/** One metered call: a Writing prompt saved as a draft. Task 1 drafts describe the chart in words; the admin attaches the image. */
export async function generatePromptDraft(adminUserId: string, task: "task1" | "task2", deps: Deps = {}): Promise<ActionResult<{ id: string }>> {
  if (task !== "task1" && task !== "task2") return fail("Choose Task 1 or Task 2.");
  const system = `You write IELTS Academic Writing prompts in the style of the real test. ${DRAFT_SAFETY}`;
  const user =
    task === "task1"
      ? 'Write one Task 1 prompt. Keys: title (short), brief (the instruction, e.g. "The chart below shows ... Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words."), chartDescription (the chart\'s data in words, so the admin can draw it).'
      : 'Write one Task 2 essay question on a common IELTS theme. Keys: title (short), brief (the question, ending "Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words."), chartDescription (empty string).';
  const res = await aiJson(
    adminUserId, system, user, `ielts_writing_${task}`,
    draftSchema({ title: { type: "string" }, brief: { type: "string" }, chartDescription: { type: "string" } }),
    (r) => parsePromptDraft(task, r), deps,
  );
  if (!res.ok) return res;
  return savePrompt(null, res.value, { generated: true });
}
