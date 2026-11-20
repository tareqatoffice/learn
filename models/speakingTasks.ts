export const TASKS = ["shadowing", "readAloud", "recordReview"] as const;
export type TaskKey = (typeof TASKS)[number];

export const DEFAULT_TARGET_MIN: Record<TaskKey, number> = { shadowing: 15, readAloud: 5, recordReview: 2 };

export const VIDEO_DEFAULT: Record<TaskKey, boolean> = { shadowing: false, readAloud: false, recordReview: true };
