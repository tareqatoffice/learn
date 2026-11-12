import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/admin/result";
import { connectDb } from "@/lib/db";
import { deleteObjects, headObject, presignPut, storageConfigured } from "@/lib/r2";
import { SpeakingLesson } from "@/models";
import { STATUSES } from "@/models/status";

export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;

const httpsUrlOrEmpty = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use an https:// link, or leave blank.");

export const lessonInput = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title is too long (200 characters at most)."),
  status: z.enum(STATUSES),
  subjectIds: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), "Unknown subject.")).default([]),
  shadowText: z.string().max(5000, "Shadowing text is too long (5000 characters at most)."),
  shadowAudioUrl: httpsUrlOrEmpty,
  shadowDurationSec: z.number().min(0, "Duration can't be negative.").max(1200, "Duration is 1200 seconds at most."),
  passage: z.string().max(5000, "Passage is too long (5000 characters at most)."),
  prompt: z.string().max(1000, "Prompt is too long (1000 characters at most)."),
});
export type LessonInput = z.input<typeof lessonInput>;

const isId = (id: unknown): id is string => typeof id === "string" && Types.ObjectId.isValid(id);
const NOT_FOUND = "That lesson no longer exists.";
const NO_STORAGE = "File storage isn't configured, so audio can't be uploaded. Set the R2_* environment variables.";

function parse(input: unknown) {
  const parsed = lessonInput.safeParse(input);
  if (parsed.success) return { data: parsed.data, errors: null };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "_")] ??= issue.message;
  return { data: null, errors };
}

export async function createLesson(input: LessonInput): Promise<ActionResult<{ id: string }>> {
  const { data, errors } = parse(input);
  if (!data) return fail(errors);
  await connectDb();
  const last = await SpeakingLesson.findOne({}, { order: 1 }).sort({ order: -1 }).lean<{ order: number }>();
  const doc = await SpeakingLesson.create({
    title: data.title,
    status: data.status,
    subjectIds: data.subjectIds.map((id) => new Types.ObjectId(id)),
    order: (last?.order ?? 0) + 1,
    shadow: { text: data.shadowText, audioUrl: data.shadowAudioUrl, durationSec: data.shadowDurationSec },
    passage: data.passage,
    prompt: data.prompt,
  });
  return ok({ id: String(doc._id) });
}

export async function updateLesson(id: string, input: LessonInput): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  const { data, errors } = parse(input);
  if (!data) return fail(errors);
  await connectDb();
  const res = await SpeakingLesson.updateOne(
    { _id: id },
    {
      $set: {
        title: data.title,
        status: data.status,
        subjectIds: data.subjectIds.map((s) => new Types.ObjectId(s)),
        "shadow.text": data.shadowText,
        "shadow.audioUrl": data.shadowAudioUrl,
        "shadow.durationSec": data.shadowDurationSec,
        passage: data.passage,
        prompt: data.prompt,
      },
    },
  );
  return res.matchedCount ? ok() : fail(NOT_FOUND);
}

/** Removes the lesson and its audio. Users' takes and day plans are left alone. */
export async function deleteLesson(id: string): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  await connectDb();
  const doc = await SpeakingLesson.findByIdAndDelete(id).lean<{ shadow?: { audioKey?: string } }>();
  if (!doc) return fail(NOT_FOUND);
  const key = doc.shadow?.audioKey;
  if (key && storageConfigured()) {
    try {
      await deleteObjects([key]);
    } catch {
      // The lesson is gone; an orphaned audio file is harmless.
    }
  }
  return ok();
}

export async function moveLesson(id: string, dir: "up" | "down"): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  await connectDb();
  const lesson = await SpeakingLesson.findById(id).lean<{ order: number }>();
  if (!lesson) return fail(NOT_FOUND);
  const up = dir === "up";
  const neighbour = await SpeakingLesson.findOne({ order: up ? { $lt: lesson.order } : { $gt: lesson.order } })
    .sort({ order: up ? -1 : 1 })
    .lean<{ _id: Types.ObjectId; order: number }>();
  if (!neighbour) return ok();
  await SpeakingLesson.bulkWrite([
    { updateOne: { filter: { _id: id }, update: { $set: { order: neighbour.order } } } },
    { updateOne: { filter: { _id: neighbour._id }, update: { $set: { order: lesson.order } } } },
  ]);
  return ok();
}

const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};

export async function startLessonAudioUpload(
  id: string,
  mime: string,
  size: number,
): Promise<ActionResult<{ uploadUrl: string; key: string }>> {
  if (!isId(id)) return fail(NOT_FOUND);
  const type = String(mime).split(";")[0].trim().toLowerCase();
  if (!type.startsWith("audio/")) return fail("Choose an audio file.");
  if (!Number.isFinite(size) || size <= 0) return fail("That file is empty.");
  if (size > AUDIO_MAX_BYTES) return fail("Audio can be 50 MB at most.");
  if (!storageConfigured()) return fail(NO_STORAGE);
  await connectDb();
  if (!(await SpeakingLesson.exists({ _id: id }))) return fail(NOT_FOUND);
  const ext = EXT[type] ?? "audio";
  const key = `lessons/${id}/${randomBytes(12).toString("hex")}.${ext}`;
  // The length is signed, so R2 refuses an upload of any other size (the 50 MB cap can't be dodged).
  return ok({ uploadUrl: await presignPut(key, type, size), key });
}

export async function confirmLessonAudio(id: string, key: string, durationSec: number): Promise<ActionResult> {
  if (!isId(id)) return fail(NOT_FOUND);
  if (typeof key !== "string" || !key.startsWith(`lessons/${id}/`) || key.includes("..") || key.length > 200) {
    return fail("That upload doesn't belong to this lesson.");
  }
  const duration = Number.isFinite(durationSec) ? Math.min(Math.max(Math.round(durationSec), 0), 1200) : 0;
  if (!storageConfigured()) return fail(NO_STORAGE);
  await connectDb();
  const lesson = await SpeakingLesson.findById(id).lean<{ shadow?: { audioKey?: string } }>();
  if (!lesson) return fail(NOT_FOUND);
  const head = await headObject(key);
  if (!head) return fail("The audio didn't finish uploading. Try again.");
  if (head.size > AUDIO_MAX_BYTES) {
    try {
      await deleteObjects([key]);
    } catch {
      // Orphaned file only.
    }
    return fail("Audio can be 50 MB at most.");
  }
  await SpeakingLesson.updateOne({ _id: id }, { $set: { "shadow.audioKey": key, "shadow.durationSec": duration } });
  const previous = lesson.shadow?.audioKey;
  if (previous && previous !== key) {
    try {
      await deleteObjects([previous]);
    } catch {
      // Orphaned file only.
    }
  }
  return ok();
}

export type AdminLesson = {
  id: string;
  title: string;
  order: number;
  status: (typeof STATUSES)[number];
  subjectIds: string[];
  shadowText: string;
  shadowAudioUrl: string;
  shadowAudioKey: string;
  shadowDurationSec: number;
  passage: string;
  prompt: string;
};

type LessonRow = {
  _id: Types.ObjectId;
  title: string;
  order: number;
  status?: (typeof STATUSES)[number];
  subjectIds?: Types.ObjectId[];
  shadow?: { audioKey?: string; audioUrl?: string; durationSec?: number; text?: string };
  passage?: string;
  prompt?: string;
};

const toAdmin = (d: LessonRow): AdminLesson => ({
  id: String(d._id),
  title: d.title,
  order: d.order,
  status: d.status ?? "draft",
  subjectIds: (d.subjectIds ?? []).map(String),
  shadowText: d.shadow?.text ?? "",
  shadowAudioUrl: d.shadow?.audioUrl ?? "",
  shadowAudioKey: d.shadow?.audioKey ?? "",
  shadowDurationSec: d.shadow?.durationSec ?? 0,
  passage: d.passage ?? "",
  prompt: d.prompt ?? "",
});

export async function listLessonsAdmin(): Promise<AdminLesson[]> {
  await connectDb();
  return (await SpeakingLesson.find({}).sort({ order: 1 }).lean<LessonRow[]>()).map(toAdmin);
}

export async function getLessonAdmin(id: string): Promise<AdminLesson | null> {
  if (!isId(id)) return null;
  await connectDb();
  const doc = await SpeakingLesson.findById(id).lean<LessonRow>();
  return doc ? toAdmin(doc) : null;
}
