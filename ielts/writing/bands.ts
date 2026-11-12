// Pure Writing maths. No mongoose or server imports: client components import this.

import { roundHalf } from "@/ielts/bands";

export type WritingTask = "task1" | "task2";
export type WritingKind = WritingTask | "full";

export type WritingCriterion = "ta" | "cc" | "lr" | "gra";
export const WRITING_CRITERIA: WritingCriterion[] = ["ta", "cc", "lr", "gra"];

/** Task Achievement is the Task 1 name; Task Response the Task 2 name. */
export const writingCriterionLabel = (c: WritingCriterion, task: WritingTask): string =>
  ({
    ta: task === "task1" ? "Task Achievement" : "Task Response",
    cc: "Coherence and Cohesion",
    lr: "Lexical Resource",
    gra: "Grammatical Range and Accuracy",
  })[c];

export const MIN_WORDS: Record<WritingTask, number> = { task1: 150, task2: 250 };
/** Seconds. */
export const TASK_LIMIT_SEC: Record<WritingTask, number> = { task1: 20 * 60, task2: 40 * 60 };
export const MAX_TEXT_CHARS = 8000;

export function wordCount(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

/** One task's band: the mean of its four whole-band criteria, to the nearest half band. */
export function taskBand(c: Record<WritingCriterion, number>): number {
  return roundHalf(WRITING_CRITERIA.reduce((s, k) => s + c[k], 0) / WRITING_CRITERIA.length);
}

/** The Writing band: Task 2 counts twice as much as Task 1. */
export function writingBand(task1: number, task2: number): number {
  return roundHalf((task1 + 2 * task2) / 3);
}

export const isWholeCriterionBand = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 9;
