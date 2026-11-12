import { Types } from "mongoose";
import { type ActionResult, fail, ok } from "@/admin/result";
import { connectDb } from "@/lib/db";
import { deleteObjects, storageConfigured } from "@/lib/r2";
import { type transcribe, sttConfigured } from "@/lib/stt";
import { IeltsBandEntry, IeltsSpeakingAttempt } from "@/models";
import { type MediaDoc, keysOf } from "@/recording/mediaCore";
import { transcribeMedia } from "@/recording/transcribe";
import { playbackUrls, prepareUpload, removeMedia, verifyUpload } from "@/recording/upload";
import { type Kind, type QuestionSet, pickQuestions } from "./questions";

import { KIND_PARTS, PART_CAP_SEC, type Part } from "./timing";

export { KIND_PARTS, PART_CAP_SEC, type Part };
type Status = "inProgress" | "complete" | "incomplete";
type Marker = { atSec: number; label: string };

const KINDS: Kind[] = ["mock", "part1", "part2", "part3"];

const MAX_MARKERS = 50;
const MAX_LABEL = 60;
const MAX_NOTES = 2000;
const MAX_TEXT = 300;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const NOT_FOUND = "Recording not found.";
const isId = (id: unknown): id is string => typeof id === "string" && Types.ObjectId.isValid(id);

type PartDoc = { part: Part; media: MediaDoc; uploadId?: string; transcript?: string; transcriptStatus?: string; markers?: Marker[] };
type AttemptDoc = {
  _id: Types.ObjectId;
  date: string;
  kind: Kind;
  status: Status;
  questions?: QuestionSet;
  generated?: boolean;
  notes?: string;
  parts: PartDoc[];
  self?: Record<string, unknown>;
  ai?: Record<string, unknown>;
  body?: Record<string, unknown>;
  paused?: boolean;
  videoUsed?: boolean;
  createdAt?: Date;
};

/** The caller's own attempt, or null for a bad id or someone else's attempt. */
async function ownAttempt(userId: string, attemptId: string): Promise<AttemptDoc | null> {
  if (!isId(userId) || !isId(attemptId)) return null;
  await connectDb();
  return IeltsSpeakingAttempt.findOne({ _id: attemptId, userId }).lean<AttemptDoc>();
}

// ---- questions given by the caller (AI-written sets come back from the client) ----

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_TEXT) : null);
const texts = (v: unknown, max: number) => (Array.isArray(v) ? v.map(text).filter((s): s is string => !!s).slice(0, max) : []);
const oid = (v: unknown) => (v instanceof Types.ObjectId ? v : isId(v) ? new Types.ObjectId(v) : undefined);

/** The parts of `set` that `kind` uses, with text trimmed and bounded; null when a needed part is missing. */
function cleanSet(kind: Kind, set: QuestionSet): QuestionSet | null {
  const out: QuestionSet = {};
  const parts = KIND_PARTS[kind];
  if (parts.includes("p1")) {
    const frames = (Array.isArray(set?.part1?.frames) ? set.part1.frames : [])
      .slice(0, 3)
      .map((f) => ({ title: text(f?.title) ?? "", questions: texts(f?.questions, 12) }))
      .filter((f) => f.questions.length);
    if (!frames.length) return null;
    const itemIds = (Array.isArray(set.part1?.itemIds) ? set.part1.itemIds : []).map(oid).filter((id): id is Types.ObjectId => !!id);
    out.part1 = { itemIds, frames };
  }
  if (parts.includes("p2")) {
    const cue = set?.part2?.cue;
    const topic = text(cue?.topic);
    if (!topic) return null;
    out.part2 = {
      itemId: oid(set.part2?.itemId),
      cue: { topic, bullets: texts(cue?.bullets, 6), explain: text(cue?.explain) ?? "", roundOff: texts(cue?.roundOff, 4) },
    };
  }
  if (parts.includes("p3")) {
    const questions = texts(set?.part3?.questions, 12);
    if (!questions.length) return null;
    out.part3 = { itemId: oid(set.part3?.itemId), questions };
  }
  return out;
}

export async function startAttempt(
  userId: string,
  input: { kind: Kind; date: string; questions?: QuestionSet; generated?: boolean },
): Promise<ActionResult<{ attemptId: string; questions: QuestionSet }>> {
  if (!storageConfigured()) return fail("Recording storage isn't set up yet.");
  if (!isId(userId)) return fail(NOT_FOUND);
  if (!KINDS.includes(input.kind)) return fail("Unknown practice type.");
  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Invalid date.");
  const dayDiff = Math.abs(Date.parse(`${input.date}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000;
  if (!(dayDiff <= 1)) return fail("That date isn't today.");

  const given = input.questions !== undefined;
  const questions = cleanSet(input.kind, given ? input.questions! : (await pickQuestions(userId, input.kind)).questions);
  if (!questions) return fail("There are no questions for this yet. Generate new ones or try another part.");

  await connectDb();
  const doc = await IeltsSpeakingAttempt.create({
    userId,
    date: input.date,
    kind: input.kind,
    questions,
    generated: given && Boolean(input.generated),
  });
  return ok({ attemptId: String(doc._id), questions });
}

export type StartPartInput = {
  part: Part;
  kind: "audio" | "video";
  mime: string;
  audioMime?: string;
  size: number;
  audioSize?: number;
};

/**
 * Presigns the upload for one part. Calling it again for a part that isn't stored yet replaces that
 * part's media (its old R2 objects are removed first); a stored part is refused.
 */
export async function startPart(
  userId: string,
  attemptId: string,
  input: StartPartInput,
): Promise<ActionResult<{ uploadUrl: string; audioUploadUrl?: string; maxBytes: number }>> {
  if (!storageConfigured()) return fail("Recording storage isn't set up yet.");
  const attempt = await ownAttempt(userId, attemptId);
  if (!attempt) return fail(NOT_FOUND);
  const { part } = input;
  if (!KIND_PARTS[attempt.kind].includes(part)) return fail("This part isn't in this practice.");
  if (attempt.status !== "inProgress") return fail("This practice is finished. Start a new one.");
  const existing = attempt.parts.find((p) => p.part === part);
  if (existing?.media.stored) return fail("This part is already saved.");

  const upload = await prepareUpload({
    keyBase: `ielts/${userId}/${String(attempt._id)}/${part}`,
    kind: input.kind,
    mime: input.mime,
    audioMime: input.audioMime,
    size: input.size,
    audioSize: input.audioSize,
    capSec: PART_CAP_SEC[part],
  });
  if (!upload.ok) return upload;
  const { media, uploadUrl, audioUploadUrl, maxBytes } = upload;
  const video = media.kind === "video" ? { videoUsed: true } : {};
  // Names this upload, so a concurrent start that replaced the row first is detected even when both reuse a key.
  const uploadId = String(new Types.ObjectId());

  if (existing) {
    // Update first: only the call that wins the row touches the old R2 objects.
    const res = await IeltsSpeakingAttempt.updateOne(
      { _id: attemptId, userId, parts: { $elemMatch: { part, "media.stored": false, uploadId: existing.uploadId ?? null } } },
      {
        $set: { "parts.$.media": media, "parts.$.uploadId": uploadId, "parts.$.transcriptStatus": "none", "parts.$.markers": [], ...video },
        $unset: { "parts.$.transcript": 1 },
      },
    );
    if (!res.matchedCount) return lostRace(userId, attemptId, part, media);
    const reused = new Set(keysOf(media));
    const stale = keysOf(existing.media).filter((k) => !reused.has(k));
    try {
      if (stale.length) await deleteObjects(stale);
    } catch (error) {
      // The row already points at the new upload; an old object left behind is only storage.
      console.error(`Couldn't remove the replaced upload ${existing.media.key}`, error);
    }
  } else {
    const res = await IeltsSpeakingAttempt.updateOne(
      { _id: attemptId, userId, "parts.part": { $ne: part } },
      { $push: { parts: { part, media, uploadId } }, $set: video },
    );
    if (!res.matchedCount) return lostRace(userId, attemptId, part, media);
  }
  return ok({ uploadUrl, ...(audioUploadUrl ? { audioUploadUrl } : {}), maxBytes });
}

/**
 * Another start for the same part wrote first. Removes the R2 keys this call presigned, except any the
 * winner's media also uses, so nothing untracked can be left in the bucket.
 */
async function lostRace(userId: string, attemptId: string, part: Part, media: MediaDoc): Promise<{ ok: false; errors: Record<string, string> }> {
  const current = (await ownAttempt(userId, attemptId))?.parts.find((p) => p.part === part);
  const kept = new Set(current ? keysOf(current.media) : []);
  const orphans = keysOf(media).filter((k) => !kept.has(k));
  try {
    if (orphans.length) await deleteObjects(orphans);
  } catch (error) {
    console.error(`Couldn't remove the presigned keys of a superseded upload ${media.key}`, error);
  }
  return current?.media.stored ? fail("This part is already saved.") : fail("This part was started again elsewhere. Try again.");
}

/**
 * Sets `complete` once every part the kind needs is stored; a no-op otherwise. Atomic against concurrent confirms.
 * Also matches `inProgress`, so a run left by a reload or navigation still completes when its last part is confirmed.
 */
async function promoteIfComplete(userId: string, attemptId: string, kind: Kind): Promise<boolean> {
  const res = await IeltsSpeakingAttempt.updateOne(
    {
      _id: attemptId,
      userId,
      status: { $in: ["inProgress", "incomplete"] },
      parts: { $all: KIND_PARTS[kind].map((part) => ({ $elemMatch: { part, "media.stored": true } })) },
    },
    { $set: { status: "complete" } },
  );
  return res.modifiedCount > 0;
}

const isMarker = (m: Marker, capSec: number) =>
  typeof m?.atSec === "number" &&
  Number.isFinite(m.atSec) &&
  m.atSec >= 0 &&
  m.atSec <= capSec &&
  typeof m.label === "string" &&
  !!m.label.trim() &&
  m.label.length <= MAX_LABEL;

/** Marks an uploaded part stored once its objects check out. Idempotent. */
export async function confirmPart(
  userId: string,
  attemptId: string,
  part: Part,
  input: { durationSec: number; markers: Marker[] },
): Promise<ActionResult> {
  const attempt = await ownAttempt(userId, attemptId);
  const row = attempt?.parts.find((p) => p.part === part);
  if (!attempt || !row) return fail(NOT_FOUND);
  if (row.media.stored) return ok();

  const { durationSec } = input;
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec < 0) return fail("Invalid recording length.");
  const capSec = row.media.capSec;
  const markers = input.markers ?? [];
  if (!Array.isArray(markers) || markers.length > MAX_MARKERS) return fail(`At most ${MAX_MARKERS} markers.`);
  if (!markers.every((m) => isMarker(m, capSec))) {
    return fail(`Each marker needs a label up to ${MAX_LABEL} characters, placed within the recording.`);
  }

  // A rejected upload keeps its row (the client uploads again to the same URLs); verifyUpload clears R2.
  const main = await verifyUpload(row.media);
  if (!main.ok) return fail(main.error);

  // Keyed on the verified upload, so a part replaced by a concurrent startPart isn't marked stored.
  const res = await IeltsSpeakingAttempt.updateOne(
    { _id: attemptId, userId, parts: { $elemMatch: { part, "media.stored": false, uploadId: row.uploadId ?? null } } },
    {
      $set: {
        "parts.$.media.stored": true,
        "parts.$.media.size": main.size,
        "parts.$.media.durationSec": Math.min(durationSec, capSec),
        "parts.$.markers": markers.map((m) => ({ atSec: m.atSec, label: m.label.trim() })),
        "parts.$.transcriptStatus": sttConfigured() ? "pending" : "unavailable",
      },
    },
  );
  if (!res.matchedCount) {
    const now = (await ownAttempt(userId, attemptId))?.parts.find((p) => p.part === part);
    // Stored meanwhile by a concurrent confirm of the same upload: fine. Otherwise the part was replaced.
    if (!(now?.media.stored && now.uploadId === row.uploadId)) return fail("This part was started again. Upload it again.");
  }
  // A part confirmed after the attempt was finished can complete it.
  await promoteIfComplete(userId, attemptId, attempt.kind);
  return ok();
}

export async function transcribePart(
  userId: string,
  attemptId: string,
  part: Part,
  deps: { transcribe?: typeof transcribe; now?: Date } = {},
): Promise<ActionResult<{ transcript: string }>> {
  const attempt = await ownAttempt(userId, attemptId);
  const row = attempt?.parts.find((p) => p.part === part);
  if (!attempt || !row || !row.media.stored) return fail(NOT_FOUND);
  if (!["pending", "failed", "running"].includes(row.transcriptStatus ?? "")) return fail("This recording can't be transcribed.");

  // Claim the part first, so two requests (a retry, a second tab) can't both spend the daily cap and
  // both pay for speech-to-text. A claim left by a crashed request can be taken over after a while.
  const now = deps.now ?? new Date();
  const claim = await IeltsSpeakingAttempt.updateOne(
    {
      _id: attemptId,
      userId,
      parts: {
        $elemMatch: {
          part,
          "media.stored": true,
          $or: [
            { transcriptStatus: { $in: ["pending", "failed"] } },
            { transcriptStatus: "running", transcribeStartedAt: { $lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
          ],
        },
      },
    },
    { $set: { "parts.$.transcriptStatus": "running", "parts.$.transcribeStartedAt": now } },
  );
  if (!claim.matchedCount) return fail("This recording is already being transcribed. Reload the page in a minute.");

  // Only this claim may write the outcome.
  const ours = { _id: attemptId, userId, parts: { $elemMatch: { part, transcriptStatus: "running", transcribeStartedAt: now } } };
  const before = row.transcriptStatus === "failed" ? "failed" : "pending";
  const res = await transcribeMedia(userId, row.media, {
    transcribe: deps.transcribe,
    label: `IELTS attempt ${attemptId} ${part}`,
    save: async (transcript) => {
      const saved = await IeltsSpeakingAttempt.updateOne(ours, {
        $set: { "parts.$.transcript": transcript, "parts.$.transcriptStatus": "done" },
      });
      return saved.matchedCount > 0;
    },
    onError: async () => {
      await IeltsSpeakingAttempt.updateOne(ours, { $set: { "parts.$.transcriptStatus": "failed" } });
    },
  });
  // Refused before the call (daily cap, missing object): release the claim as it was.
  if (!res.ok) await IeltsSpeakingAttempt.updateOne(ours, { $set: { "parts.$.transcriptStatus": before } });
  return res;
}

/** A transcription claimed longer ago than this is treated as abandoned. */
const STALE_CLAIM_MS = 5 * 60_000;

/** Ends the attempt: complete when every part its kind needs is stored, otherwise incomplete. */
export async function finishAttempt(
  userId: string,
  attemptId: string,
  input: { notes?: string; paused: boolean },
): Promise<ActionResult<{ status: Status }>> {
  const attempt = await ownAttempt(userId, attemptId);
  if (!attempt) return fail(NOT_FOUND);
  if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > MAX_NOTES)) {
    return fail(`Notes are limited to ${MAX_NOTES} characters.`);
  }
  const stored = new Set(attempt.parts.filter((p) => p.media.stored).map((p) => p.part));
  const status: Status = KIND_PARTS[attempt.kind].every((p) => stored.has(p)) ? "complete" : "incomplete";
  const set: Record<string, unknown> = { status };
  if (input.paused === true) set.paused = true;
  if (input.notes?.trim()) set.notes = input.notes.trim();
  await IeltsSpeakingAttempt.updateOne({ _id: attemptId, userId }, { $set: set });
  // A part confirmed between our read and write would otherwise leave a full attempt marked incomplete.
  if (status === "incomplete" && (await promoteIfComplete(userId, attemptId, attempt.kind))) return ok({ status: "complete" as Status });
  return ok({ status });
}

/**
 * Ends a run that was left in progress (a reload or navigation mid-run): complete when every part its kind
 * needs is stored, otherwise incomplete. Returns the status now held, or null when the attempt isn't the user's.
 * A finished attempt is left as it is.
 */
export async function settleAttempt(userId: string, attemptId: string): Promise<Status | null> {
  const attempt = await ownAttempt(userId, attemptId);
  if (!attempt) return null;
  if (attempt.status !== "inProgress") return attempt.status;
  if (await promoteIfComplete(userId, attemptId, attempt.kind)) return "complete";
  const res = await IeltsSpeakingAttempt.updateOne({ _id: attemptId, userId, status: "inProgress" }, { $set: { status: "incomplete" } });
  if (res.modifiedCount > 0) return "incomplete";
  return (await ownAttempt(userId, attemptId))?.status ?? null;
}

type Plain<T> = T extends Types.ObjectId ? string : T extends (infer U)[] ? Plain<U>[] : T extends object ? { [K in keyof T]: Plain<T[K]> } : T;

export type PartView = {
  part: Part;
  kind: "audio" | "video";
  mime: string;
  stored: boolean;
  durationSec: number;
  capSec: number;
  size?: number;
  transcript?: string;
  transcriptStatus: string;
  markers: Marker[];
  mediaUrl?: string;
  audioUrl?: string;
};

/** An attempt as plain JSON (ids as strings), with playback URLs for its stored parts. */
export type AttemptView = {
  id: string;
  date: string;
  kind: Kind;
  status: Status;
  questions: Plain<QuestionSet>;
  generated: boolean;
  notes?: string;
  paused: boolean;
  videoUsed: boolean;
  parts: PartView[];
  self?: Record<string, unknown>;
  ai?: Record<string, unknown>;
  body?: Record<string, unknown>;
  createdAt?: string;
};

const plain = <T>(v: T): Plain<T> | undefined => (v === undefined || v === null ? undefined : JSON.parse(JSON.stringify(v)));

export async function getAttempt(userId: string, id: string): Promise<AttemptView | null> {
  const a = await ownAttempt(userId, id);
  if (!a) return null;
  const parts = await Promise.all(
    a.parts.map(async (p): Promise<PartView> => {
      const urls = await playbackUrls(p.media);
      return {
        part: p.part,
        kind: p.media.kind,
        mime: p.media.mime,
        stored: Boolean(p.media.stored),
        durationSec: p.media.durationSec,
        capSec: p.media.capSec,
        ...(p.media.size !== undefined ? { size: p.media.size } : {}),
        ...(p.transcript !== undefined ? { transcript: p.transcript } : {}),
        transcriptStatus: p.transcriptStatus ?? "none",
        markers: (p.markers ?? []).map((m) => ({ atSec: m.atSec, label: m.label })),
        ...(urls ? { mediaUrl: urls.url, ...(urls.audioUrl ? { audioUrl: urls.audioUrl } : {}) } : {}),
      };
    }),
  );
  const view: AttemptView = {
    id: String(a._id),
    date: a.date,
    kind: a.kind,
    status: a.status,
    questions: plain(a.questions) ?? {},
    generated: Boolean(a.generated),
    paused: Boolean(a.paused),
    videoUsed: Boolean(a.videoUsed),
    parts,
  };
  if (a.notes !== undefined) view.notes = a.notes;
  for (const key of ["self", "ai", "body"] as const) if (a[key]) view[key] = plain(a[key]);
  if (a.createdAt) view.createdAt = new Date(a.createdAt).toISOString();
  return view;
}

export type AttemptSummary = {
  id: string;
  date: string;
  kind: Kind;
  status: Status;
  /** Stored parts, in recording order. */
  parts: Part[];
  durationSec: number;
  aiOverall?: number;
};

/** Attempts with at least one stored part, newest first. */
export async function listAttempts(userId: string, filter: { kind?: Kind; limit?: number } = {}): Promise<AttemptSummary[]> {
  if (!isId(userId)) return [];
  await connectDb();
  const query: Record<string, unknown> = { userId, "parts.media.stored": true };
  if (filter.kind && KINDS.includes(filter.kind)) query.kind = filter.kind;
  const limit = Math.min(Math.max(Math.floor(filter.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const docs = await IeltsSpeakingAttempt.find(query).sort({ date: -1, _id: -1 }).limit(limit).lean<AttemptDoc[]>();
  return docs.map((d) => {
    const stored = d.parts.filter((p) => p.media.stored);
    const aiOverall = (d.ai as { overall?: unknown } | undefined)?.overall;
    return {
      id: String(d._id),
      date: d.date,
      kind: d.kind,
      status: d.status,
      parts: KIND_PARTS[d.kind].filter((part) => stored.some((p) => p.part === part)),
      durationSec: stored.reduce((sum, p) => sum + (p.media.durationSec ?? 0), 0),
      ...(typeof aiOverall === "number" ? { aiOverall } : {}),
    };
  });
}

/** Deletes an attempt, stored or only started: its R2 objects, its mock band entries, then the document. */
export async function deleteAttempt(userId: string, id: string): Promise<ActionResult> {
  const attempt = await ownAttempt(userId, id);
  if (!attempt) return fail(NOT_FOUND);
  try {
    await removeMedia(attempt.parts.map((p) => p.media));
  } catch {
    return fail("Couldn't delete the recording. Try again.");
  }
  await IeltsBandEntry.deleteMany({ userId, attemptId: id });
  await IeltsSpeakingAttempt.deleteOne({ _id: id, userId });
  return ok();
}
