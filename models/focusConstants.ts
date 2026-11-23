export const FOCUS_AREAS = ["graphs", "speaking", "notes", "interview", "ielts", "coding", "general"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

export const FOCUS_LABEL_MAX = 160;
export const FOCUS_PATH_MAX = 300;
export const FOCUS_MAX_SECONDS = 8 * 60 * 60;
export const FOCUS_MAX_TARGET_MINUTES = 480;
export const FOCUS_RUN_ID_MAX = 64;
export const FOCUS_MAX_DRIFTS = 999;
export const FOCUS_RATING_MIN = 1;
export const FOCUS_RATING_MAX = 5;
export const FOCUS_DISTRACTIONS = ["phone", "thoughts", "noise", "tiredness", "people", "other"] as const;
export type FocusDistraction = (typeof FOCUS_DISTRACTIONS)[number];
