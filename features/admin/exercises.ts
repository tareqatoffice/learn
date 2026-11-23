import { randomBytes } from "node:crypto";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/features/admin/result";
import { PHOTO_KEY, PHOTO_MAX_BYTES, PHOTO_TYPES, photoUrl } from "@/features/exercise/catalog";
import type { ExerciseRow } from "@/features/exercise/library";
import { connectDb } from "@/lib/db";
import { deleteObjects, headObject, presignPut, storageConfigured } from "@/lib/r2";
import { Exercise, ExercisePlanWeek, WorkoutSession } from "@/models";
import {
  EXERCISE_MODES,
  EXERCISE_TYPES,
  FOCUSES,
  type Difficulty,
  type ExerciseMode,
  type ExerciseType,
  type Focus,
} from "@/models/exerciseConstants";

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PHOTO_SLOTS = ["startPhoto", "endPhoto"] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

const NOT_FOUND = "That exercise no longer exists.";
const NO_STORAGE = "File storage isn't configured, so photos can't be uploaded. Set the R2_* environment variables.";

export const exerciseInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long (100 characters at most)."),
  focus: z
    .array(z.enum(FOCUSES))
    .min(1, "Pick at least one focus.")
    .transform((f) => [...new Set(f)]),
  type: z.enum(EXERCISE_TYPES),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  mode: z.enum(EXERCISE_MODES),
  equipment: z
    .string()
    .trim()
    .max(60, "Equipment is too long (60 characters at most).")
    .transform((v) => v || "none"),
  cues: z
    .array(z.string().trim().max(300, "Each cue is 300 characters at most."))
    .transform((c) => c.filter(Boolean))
    .pipe(z.array(z.string()).min(1, "Add at least one cue.").max(8, "Eight cues at most.")),
  order: z.number({ error: "Order is a whole number." }).int("Order is a whole number.").min(0, "Order can't be negative.").max(1_000_000),
});
export type ExerciseInput = z.input<typeof exerciseInput>;

const createInput = exerciseInput.extend({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(60, "Id is 60 characters at most.")
    .regex(SLUG, "Use lowercase letters, numbers and single dashes, like push-up.")
    .refine((s) => s !== "new", "That id is reserved. Pick another."),
});
export type CreateExerciseInput = z.input<typeof createInput>;

function errorsOf(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0] ?? "_")] ??= issue.message;
  return errors;
}

const fields = (d: z.output<typeof exerciseInput>) => ({
  name: d.name,
  focus: d.focus,
  type: d.type,
  difficulty: d.difficulty,
  mode: d.mode,
  equipment: d.equipment,
  cues: d.cues,
  order: d.order,
});

async function quietDelete(keys: string[]) {
  const list = keys.filter(Boolean);
  if (!list.length || !storageConfigured()) return;
  try {
    await deleteObjects(list);
  } catch {
  }
}

export async function createExercise(input: CreateExerciseInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return fail(errorsOf(parsed.error));
  await connectDb();
  if (await Exercise.exists({ slug: parsed.data.slug })) return fail({ slug: "An exercise with this id already exists." });
  try {
    await Exercise.create({ slug: parsed.data.slug, ...fields(parsed.data) });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail({ slug: "An exercise with this id already exists." });
    throw error;
  }
  return ok({ id: parsed.data.slug });
}

export async function updateExercise(slug: string, input: ExerciseInput): Promise<ActionResult> {
  const parsed = exerciseInput.safeParse(input);
  if (!parsed.success) return fail(errorsOf(parsed.error));
  await connectDb();
  const res = await Exercise.updateOne({ slug }, { $set: fields(parsed.data) });
  return res.matchedCount ? ok() : fail(NOT_FOUND);
}

export async function setExerciseArchived(slug: string, archived: boolean): Promise<ActionResult> {
  await connectDb();
  const res = await Exercise.updateOne({ slug }, { $set: { archived } });
  return res.matchedCount ? ok() : fail(NOT_FOUND);
}

export async function exerciseInUse(slug: string): Promise<boolean> {
  await connectDb();
  const [plan, session] = await Promise.all([
    ExercisePlanWeek.exists({ "days.items.exerciseId": slug }),
    WorkoutSession.exists({ "items.exerciseId": slug }),
  ]);
  return Boolean(plan || session);
}

export async function deleteExercise(slug: string): Promise<ActionResult> {
  await connectDb();
  if (await exerciseInUse(slug)) return fail("Plans or workouts use this exercise, so it can't be deleted. Archive it instead.");
  const doc = await Exercise.findOneAndDelete({ slug }).lean<ExerciseRow>();
  if (!doc) return fail(NOT_FOUND);
  await quietDelete([doc.startPhoto ?? "", doc.endPhoto ?? ""]);
  return ok();
}

export async function startPhotoUpload(
  slug: string,
  mime: string,
  size: number,
): Promise<ActionResult<{ uploadUrl: string; key: string }>> {
  const type = String(mime).split(";")[0].trim().toLowerCase();
  const ext = PHOTO_TYPES[type];
  if (!ext) return fail("Choose a JPEG, PNG or WebP image.");
  if (!Number.isFinite(size) || size <= 0) return fail("That file is empty.");
  if (size > PHOTO_MAX_BYTES) return fail("Photos can be 5 MB at most.");
  if (!storageConfigured()) return fail(NO_STORAGE);
  await connectDb();
  if (!(await Exercise.exists({ slug }))) return fail(NOT_FOUND);
  const key = `exercise/${slug}/${randomBytes(12).toString("hex")}.${ext}`;
  return ok({ uploadUrl: await presignPut(key, type, size), key });
}

export async function confirmPhoto(slug: string, slot: PhotoSlot, key: string): Promise<ActionResult<{ url: string }>> {
  if (!PHOTO_SLOTS.includes(slot)) return fail("Unknown photo.");
  if (typeof key !== "string" || !PHOTO_KEY.test(key) || !key.startsWith(`exercise/${slug}/`)) {
    return fail("That upload doesn't belong to this exercise.");
  }
  if (!storageConfigured()) return fail(NO_STORAGE);
  await connectDb();
  const other = otherSlot(slot);
  const doc = await Exercise.findOne({ slug }).lean<ExerciseRow>();
  if (!doc) return fail(NOT_FOUND);
  if (doc[other] === key) return fail("That photo is already used for the other frame.");
  const head = await headObject(key);
  if (!head) return fail("The photo didn't finish uploading. Try again.");
  if (head.size > PHOTO_MAX_BYTES) {
    await quietDelete([key]);
    return fail("Photos can be 5 MB at most.");
  }
  const before = await Exercise.findOneAndUpdate({ slug }, { $set: { [slot]: key } }).lean<ExerciseRow>();
  if (!before) return fail(NOT_FOUND);
  const previous = before[slot] ?? "";
  if (previous && previous !== key && previous !== before[other]) await quietDelete([previous]);
  return ok({ url: photoUrl(key) });
}

const otherSlot = (slot: PhotoSlot): PhotoSlot => (slot === "startPhoto" ? "endPhoto" : "startPhoto");

export async function removePhoto(slug: string, slot: PhotoSlot): Promise<ActionResult> {
  if (!PHOTO_SLOTS.includes(slot)) return fail("Unknown photo.");
  await connectDb();
  const doc = await Exercise.findOneAndUpdate({ slug }, { $set: { [slot]: "" } }).lean<ExerciseRow>();
  if (!doc) return fail(NOT_FOUND);
  const previous = doc[slot] ?? "";
  if (previous !== doc[otherSlot(slot)]) await quietDelete([previous]);
  return ok();
}

export type AdminExercise = {
  id: string;
  name: string;
  focus: Focus[];
  type: ExerciseType;
  difficulty: Difficulty;
  mode: ExerciseMode;
  equipment: string;
  cues: string[];
  order: number;
  archived: boolean;
  startPhotoUrl: string;
  endPhotoUrl: string;
};

const toAdmin = (d: ExerciseRow): AdminExercise => ({
  id: d.slug,
  name: d.name,
  focus: [...(d.focus ?? [])],
  type: d.type,
  difficulty: d.difficulty,
  mode: d.mode,
  equipment: d.equipment || "none",
  cues: [...(d.cues ?? [])],
  order: d.order ?? 0,
  archived: Boolean(d.archived),
  startPhotoUrl: d.startPhoto ? photoUrl(d.startPhoto) : "",
  endPhotoUrl: d.endPhoto ? photoUrl(d.endPhoto) : "",
});

export async function listExercisesAdmin(): Promise<AdminExercise[]> {
  await connectDb();
  return (await Exercise.find({}).sort({ order: 1, name: 1 }).lean<ExerciseRow[]>()).map(toAdmin);
}

export async function getExerciseAdmin(slug: string): Promise<AdminExercise | null> {
  await connectDb();
  const doc = await Exercise.findOne({ slug }).lean<ExerciseRow>();
  return doc ? toAdmin(doc) : null;
}

export async function nextExerciseOrder(): Promise<number> {
  await connectDb();
  const last = await Exercise.findOne({}, { order: 1 }).sort({ order: -1 }).lean<{ order?: number }>();
  return (last?.order ?? 0) + 10;
}
