/** Mongoose-free focus constants, shared by the model and client code. */

/** Areas a focus session can belong to; "general" is any page outside a track. */
export const FOCUS_AREAS = ["graphs", "speaking", "notes", "interview", "ielts", "coding", "general"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

export const FOCUS_LABEL_MAX = 160;
export const FOCUS_PATH_MAX = 300;
/** Longest single session we accept (8 hours). */
export const FOCUS_MAX_SECONDS = 8 * 60 * 60;
export const FOCUS_MAX_TARGET_MINUTES = 480;
export const FOCUS_RUN_ID_MAX = 64;
