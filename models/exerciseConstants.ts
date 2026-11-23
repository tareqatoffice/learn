export const SEXES = ["male", "female", "unspecified"] as const;
export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const FOCUSES = ["full", "upper", "lower", "core", "cardio", "stretch"] as const;
export const FEELS = ["easy", "ok", "hard"] as const;

export type Sex = (typeof SEXES)[number];
export type Level = (typeof LEVELS)[number];
export type Focus = (typeof FOCUSES)[number];
export type Feel = (typeof FEELS)[number];

export const EXERCISE_TYPES = ["strength", "cardio", "hiit", "stretch"] as const;
export const EXERCISE_MODES = ["reps", "time"] as const;
export const DIFFICULTIES = [1, 2, 3] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];
export type ExerciseMode = (typeof EXERCISE_MODES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
