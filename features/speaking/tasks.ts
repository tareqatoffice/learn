import { DEFAULT_TARGET_MIN, TASKS, VIDEO_DEFAULT, type TaskKey } from "@/models/speakingTasks";

export { DEFAULT_TARGET_MIN, TASKS, VIDEO_DEFAULT, type TaskKey };

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

