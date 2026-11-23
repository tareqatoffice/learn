import type { Difficulty, ExerciseMode, ExerciseType, Focus } from "@/models/exerciseConstants";

/** An exercise as the app uses it (mongoose-free, safe for client components). */
export type Exercise = {
  id: string;
  name: string;
  focus: Focus[];
  type: ExerciseType;
  difficulty: Difficulty;
  mode: ExerciseMode;
  equipment: string;
  cues: string[];
  /** Photo URLs, start then end; empty when the move has no photo yet. */
  photos: string[];
  archived: boolean;
};

/** Exercises by id, for looking up the moves a plan names. */
export type ExerciseMap = Record<string, Exercise>;

export const PLACEHOLDER = "/assets/exercise/placeholder.svg";

/** Photos live in R2 under `exercise/<slug>/<random>.<ext>` and are served by `app/media/[...key]`. */
export const PHOTO_KEY = /^exercise\/[a-z0-9-]{1,60}\/[a-f0-9]{16,64}\.(?:jpg|png|webp)$/;
export const PHOTO_TYPES: Record<string, "jpg" | "png" | "webp"> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PHOTO_CONTENT_TYPE: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const photoUrl = (key: string) => `/media/${key}`;

export function exerciseImage(e: Exercise, frame: 0 | 1): string {
  return e.photos[frame] ?? e.photos[0] ?? PLACEHOLDER;
}

/** Active moves for a focus up to a difficulty: the pool plans pick from. */
export function allowedFor(pool: readonly Exercise[], focus: Focus, maxDifficulty: Difficulty): Exercise[] {
  return pool.filter((e) => !e.archived && e.focus.includes(focus) && e.difficulty <= maxDifficulty);
}

export const toMap = (list: readonly Exercise[]): ExerciseMap => Object.fromEntries(list.map((e) => [e.id, e]));
