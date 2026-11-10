import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { SpeakingLesson, SpeakingTake } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";
import { deleteObjects, headObject, presignGet, presignPut, storageConfigured } from "@/lib/r2";
import { sttConfigured } from "@/lib/stt";
import { takeCapBytes, takeCapSec } from "./schedule";
import { TASKS, TASK_LABEL, type TaskKey } from "./tasks";

const MAX_TEXT = 5000;
const MAX_NOTE = 1000;
const MAX_MARKERS = 50;
const MAX_LABEL = 60;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const UPLOAD_FAILED = "Your recording didn't finish uploading. Try again.";

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "audio/mp4": "m4a",
};

/** Lower-cased mime without parameters (e.g. `;codecs=opus`). */
const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();
const isId = (id: string) => typeof id === "string" && Types.ObjectId.isValid(id);

export type StartTakeInput = {
  task: TaskKey;
  date: string;
  lessonId: string | null;
  material: { title?: string; text?: string; prompt?: string; generated: boolean };
  kind: "audio" | "video";
  mime: string;
  audioMime?: string;
  clipSec?: number;
};

const mainKey = (userId: string, takeId: string, ext: string) => `takes/${userId}/${takeId}.${ext}`;
const audioKeyFor = (userId: string, takeId: string, ext: string) => `takes/${userId}/${takeId}.audio.${ext}`;

export async function startTake(
  userId: string,
  input: StartTakeInput,
): Promise<ActionResult<{ takeId: string; uploadUrl: string; audioUploadUrl?: string; maxBytes: number; capSec: number }>> {
  if (!storageConfigured()) return fail("Recording storage isn't set up yet.");
  if (!isId(userId)) return fail("Recording not found.");
  if (!TASKS.includes(input.task)) return fail("Unknown task.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Invalid date.");
  const dayDiff = Math.abs(Date.parse(`${input.date}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000;
  if (!(dayDiff <= 1)) return fail("That date isn't today.");
  if (input.kind !== "audio" && input.kind !== "video") return fail("Unknown recording type.");

  const mime = baseMime(input.mime ?? "");
  const ext = EXT[mime];
  if (!ext || !mime.startsWith(`${input.kind}/`)) return fail("That recording format isn't supported.");

  let audioMime: string | undefined;
  let audioExt: string | undefined;
  if (input.kind === "video") {
    audioMime = baseMime(input.audioMime ?? "audio/webm");
    audioExt = audioMime.startsWith("audio/") ? EXT[audioMime] : undefined;
    if (!audioExt) return fail("That recording format isn't supported.");
  }

  const m = input.material ?? { generated: false };
  for (const value of [m.title, m.text, m.prompt]) {
    if (value !== undefined && (typeof value !== "string" || value.length > MAX_TEXT)) {
      return fail(`Practice text is limited to ${MAX_TEXT} characters.`);
    }
  }

  let lessonId: Types.ObjectId | undefined;
  if (input.lessonId) {
    if (!isId(input.lessonId)) return fail("That lesson is not available.");
    await connectDb();
    if (!(await SpeakingLesson.exists({ _id: input.lessonId, status: "published" }))) {
      return fail("That lesson is not available.");
    }
    lessonId = new Types.ObjectId(input.lessonId);
  }

  const clipSec = typeof input.clipSec === "number" && Number.isFinite(input.clipSec) ? input.clipSec : undefined;
  const capSec = takeCapSec(input.task, clipSec);
  const video = input.kind === "video";
  const maxBytes = takeCapBytes(capSec, video);

  await connectDb();
  const _id = new Types.ObjectId();
  const takeId = String(_id);
  const key = mainKey(userId, takeId, ext);
  const audioKey = audioExt ? audioKeyFor(userId, takeId, audioExt) : undefined;

  await SpeakingTake.create({
    _id,
    userId,
    date: input.date,
    task: input.task,
    lessonId,
    material: { title: m.title, text: m.text, prompt: m.prompt, generated: Boolean(m.generated) },
    media: { kind: input.kind, key, mime, audioKey, audioMime, durationSec: 0, capSec, stored: false },
  });

  const uploadUrl = await presignPut(key, mime);
  const audioUploadUrl = audioKey && audioMime ? await presignPut(audioKey, audioMime) : undefined;
  return ok({ takeId, uploadUrl, ...(audioUploadUrl ? { audioUploadUrl } : {}), maxBytes, capSec });
}

type MediaDoc = {
  kind: "audio" | "video";
  key: string;
  mime: string;
  audioKey?: string;
  audioMime?: string;
  durationSec: number;
  capSec: number;
  size?: number;
  stored: boolean;
};

type TakeDoc = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: string;
  task: TaskKey;
  lessonId?: Types.ObjectId;
  material?: { title?: string; text?: string; prompt?: string; generated?: boolean };
  media: MediaDoc;
  transcript?: string;
  transcriptStatus?: string;
  self?: { fluency?: number; confidence?: number; eyeContact?: number; gestures?: number; note?: string };
  markers?: { atSec: number; label: string }[];
  ai?: {
    speech?: Record<string, unknown> & { fluency?: number; vocabulary?: number; grammar?: number };
    body?: Record<string, unknown> & { confidence?: number };
    model?: string;
    at?: Date;
  };
};

/** The caller's own take, or null for a bad id or someone else's take. */
async function ownTake(userId: string, takeId: string): Promise<TakeDoc | null> {
  if (!isId(takeId) || !isId(userId)) return null;
  await connectDb();
  return SpeakingTake.findOne({ _id: takeId, userId }).lean<TakeDoc>();
}

export async function confirmTake(userId: string, takeId: string, durationSec: number): Promise<ActionResult> {
  const take = await ownTake(userId, takeId);
  if (!take) return fail("Recording not found.");
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec < 0) {
    return fail("Invalid recording length.");
  }

  const { media } = take;
  if (media.stored) return ok();
  const main = await headObject(media.key);
  if (!main || main.size <= 0 || main.size > takeCapBytes(media.capSec, media.kind === "video")) {
    return fail(UPLOAD_FAILED);
  }
  if (media.audioKey) {
    const audio = await headObject(media.audioKey);
    if (!audio || audio.size <= 0 || audio.size > takeCapBytes(media.capSec, false)) return fail(UPLOAD_FAILED);
  }

  await SpeakingTake.updateOne(
    { _id: takeId, userId, "media.stored": false },
    {
      $set: {
        "media.stored": true,
        "media.size": main.size,
        "media.durationSec": Math.min(durationSec, media.capSec),
        transcriptStatus: sttConfigured() ? "pending" : "unavailable",
      },
    },
  );
  return ok();
}

export type TakeView = {
  id: string;
  date: string;
  task: TaskKey;
  lessonId?: string;
  material: { title?: string; text?: string; prompt?: string; generated: boolean };
  kind: "audio" | "video";
  mime: string;
  durationSec: number;
  capSec: number;
  size?: number;
  transcript?: string;
  transcriptStatus: string;
  self?: { fluency?: number; confidence?: number; eyeContact?: number; gestures?: number; note?: string };
  markers: { atSec: number; label: string }[];
  ai?: TakeDoc["ai"];
  mediaUrl: string;
  audioUrl?: string;
  sourceAudioUrl?: string;
};

export async function getTake(userId: string, takeId: string): Promise<TakeView | null> {
  const take = await ownTake(userId, takeId);
  if (!take || !take.media.stored) return null;
  const { media } = take;

  let sourceAudioUrl: string | undefined;
  if (take.task === "shadowing" && take.lessonId) {
    const lesson = await SpeakingLesson.findById(take.lessonId)
      .select("shadow")
      .lean<{ shadow?: { audioKey?: string; audioUrl?: string } }>();
    if (lesson?.shadow?.audioKey) sourceAudioUrl = await presignGet(lesson.shadow.audioKey);
    else if (lesson?.shadow?.audioUrl) sourceAudioUrl = lesson.shadow.audioUrl;
  }

  const ai = take.ai ? JSON.parse(JSON.stringify(take.ai)) : undefined;
  return {
    id: String(take._id),
    date: take.date,
    task: take.task,
    lessonId: take.lessonId ? String(take.lessonId) : undefined,
    material: {
      title: take.material?.title,
      text: take.material?.text,
      prompt: take.material?.prompt,
      generated: Boolean(take.material?.generated),
    },
    kind: media.kind,
    mime: media.mime,
    durationSec: media.durationSec,
    capSec: media.capSec,
    size: media.size,
    transcript: take.transcript,
    transcriptStatus: take.transcriptStatus ?? "none",
    self: take.self ? { ...take.self } : undefined,
    markers: (take.markers ?? []).map((m) => ({ atSec: m.atSec, label: m.label })),
    ai,
    mediaUrl: await presignGet(media.key),
    audioUrl: media.audioKey ? await presignGet(media.audioKey) : undefined,
    sourceAudioUrl,
  };
}

const isScore = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;

export async function saveSelfRating(
  userId: string,
  takeId: string,
  input: {
    fluency: number;
    confidence: number;
    eyeContact?: number;
    gestures?: number;
    note?: string;
    markers?: { atSec: number; label: string }[];
  },
): Promise<ActionResult> {
  const take = await ownTake(userId, takeId);
  if (!take || !take.media.stored) return fail("Recording not found.");

  const errors: Record<string, string> = {};
  for (const field of ["fluency", "confidence"] as const) {
    if (!isScore(input[field])) errors[field] = "Pick a whole number from 1 to 5.";
  }
  for (const field of ["eyeContact", "gestures"] as const) {
    const value = input[field];
    if (value === undefined) continue;
    if (take.media.kind !== "video") errors[field] = "Only video recordings can be rated on this.";
    else if (!isScore(value)) errors[field] = "Pick a whole number from 1 to 5.";
  }
  if (input.note !== undefined && (typeof input.note !== "string" || input.note.length > MAX_NOTE)) {
    errors.note = `Notes are limited to ${MAX_NOTE} characters.`;
  }
  const markers = input.markers ?? [];
  if (!Array.isArray(markers) || markers.length > MAX_MARKERS) {
    errors.markers = `At most ${MAX_MARKERS} markers.`;
  } else if (
    markers.some(
      (m) =>
        typeof m?.atSec !== "number" ||
        !Number.isFinite(m.atSec) ||
        m.atSec < 0 ||
        m.atSec > take.media.durationSec ||
        typeof m.label !== "string" ||
        !m.label.trim() ||
        m.label.length > MAX_LABEL,
    )
  ) {
    errors.markers = `Each marker needs a label up to ${MAX_LABEL} characters, placed within the recording.`;
  }
  if (Object.keys(errors).length) return fail(errors);

  const self: Record<string, unknown> = { fluency: input.fluency, confidence: input.confidence };
  if (input.eyeContact !== undefined) self.eyeContact = input.eyeContact;
  if (input.gestures !== undefined) self.gestures = input.gestures;
  if (input.note?.trim()) self.note = input.note.trim();

  await SpeakingTake.updateOne(
    { _id: takeId, userId },
    { $set: { self, markers: markers.map((m) => ({ atSec: m.atSec, label: m.label.trim() })) } },
  );
  return ok();
}

function keysOf(media: MediaDoc): string[] {
  return media.audioKey ? [media.key, media.audioKey] : [media.key];
}

export async function deleteTake(userId: string, takeId: string): Promise<ActionResult> {
  const take = await ownTake(userId, takeId);
  if (!take) return fail("Recording not found.");
  try {
    await deleteObjects(keysOf(take.media));
  } catch {
    return fail("Couldn't delete the recording. Try again.");
  }
  await SpeakingTake.deleteOne({ _id: takeId, userId });
  return ok();
}

export async function deleteAllTakes(userId: string): Promise<number> {
  if (!isId(userId)) return 0;
  await connectDb();
  const takes = await SpeakingTake.find({ userId }).select("media.key media.audioKey").lean<{ _id: Types.ObjectId; media: MediaDoc }[]>();
  if (!takes.length) return 0;
  await deleteObjects(takes.flatMap((t) => keysOf(t.media)));
  const res = await SpeakingTake.deleteMany({ userId, _id: { $in: takes.map((t) => t._id) } });
  return res.deletedCount ?? 0;
}

export type TakeSummary = {
  id: string;
  date: string;
  task: TaskKey;
  kind: "audio" | "video";
  durationSec: number;
  title: string;
  self?: { fluency: number };
  ai?: { fluency?: number };
};

/** Stored takes, newest first. `before` is a take id: only older takes are returned. */
export async function listTakes(
  userId: string,
  filter: { task?: TaskKey; limit?: number; before?: string },
): Promise<TakeSummary[]> {
  if (!isId(userId)) return [];
  await connectDb();
  const query: Record<string, unknown> = { userId, "media.stored": true };
  if (filter.task && TASKS.includes(filter.task)) query.task = filter.task;
  if (filter.before && isId(filter.before)) query._id = { $lt: new Types.ObjectId(filter.before) };
  const limit = Math.min(Math.max(Math.floor(filter.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const docs = await SpeakingTake.find(query).sort({ _id: -1 }).limit(limit).lean<TakeDoc[]>();
  return docs.map((d) => ({
    id: String(d._id),
    date: d.date,
    task: d.task,
    kind: d.media.kind,
    durationSec: d.media.durationSec,
    title: d.material?.title?.trim() || TASK_LABEL[d.task],
    ...(typeof d.self?.fluency === "number" ? { self: { fluency: d.self.fluency } } : {}),
    ...(typeof d.ai?.speech?.fluency === "number" ? { ai: { fluency: d.ai.speech.fluency } } : {}),
  }));
}
