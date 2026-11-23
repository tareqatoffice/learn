/** Mongoose-free part of the app settings: types, defaults, limits and validation. Client code imports this file, not `lib/appSettings`. */
import { FOCUSES, type Focus } from "@/models/exerciseConstants";
import { FOCUS_MAX_TARGET_MINUTES } from "@/models/focusConstants";

export type AppSettingsView = {
  /** Session lengths (minutes) offered by the focus timer, besides an open-ended run. */
  focusPresets: number[];
  /** Order of workout focuses across the week; the last workout of a 3+ day week is always a stretch. */
  exerciseRotation: Focus[];
};

export const DEFAULT_APP_SETTINGS: AppSettingsView = {
  focusPresets: [15, 25, 50],
  exerciseRotation: ["full", "lower", "upper", "cardio", "core", "full"],
};

export const FOCUS_PRESETS_MAX = 3;
export const ROTATION_MAX = 7;
/** Stretch days are placed by the planner itself, so the rotation picks from the rest. */
export const ROTATION_FOCUSES = FOCUSES.filter((f) => f !== "stretch") as Exclude<Focus, "stretch">[];

const validPresets = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length >= 1 &&
  v.length <= FOCUS_PRESETS_MAX &&
  v.every((n) => Number.isInteger(n) && n >= 1 && n <= FOCUS_MAX_TARGET_MINUTES);

const validRotation = (v: unknown): v is Focus[] =>
  Array.isArray(v) && v.length >= 1 && v.length <= ROTATION_MAX && v.every((f) => (ROTATION_FOCUSES as string[]).includes(f));

/** Saved settings over the defaults; a malformed stored value falls back to its default. */
export function resolveAppSettings(doc?: Partial<Record<keyof AppSettingsView, unknown>> | null): AppSettingsView {
  return {
    focusPresets: validPresets(doc?.focusPresets) ? doc.focusPresets : DEFAULT_APP_SETTINGS.focusPresets,
    exerciseRotation: validRotation(doc?.exerciseRotation) ? doc.exerciseRotation : DEFAULT_APP_SETTINGS.exerciseRotation,
  };
}
