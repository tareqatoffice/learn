export const TASKS = ["shadowing", "readAloud", "recordReview"] as const;
export type TaskKey = (typeof TASKS)[number];

export const TASK_SLUG: Record<TaskKey, string> = {
  shadowing: "shadowing",
  readAloud: "read-aloud",
  recordReview: "record-review",
};

export function taskFromSlug(slug: string): TaskKey | null {
  return TASKS.find((task) => TASK_SLUG[task] === slug) ?? null;
}

export const TASK_LABEL: Record<TaskKey, string> = {
  shadowing: "Shadowing",
  readAloud: "Read aloud",
  recordReview: "Record and review",
};

/** Daily target in minutes. */
export const DEFAULT_TARGET_MIN: Record<TaskKey, number> = { shadowing: 15, readAloud: 5, recordReview: 2 };

/** Whether each task records video by default. */
export const VIDEO_DEFAULT: Record<TaskKey, boolean> = { shadowing: false, readAloud: false, recordReview: true };
