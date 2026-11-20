"use server";

import { adminContext } from "@/features/admin/action";
import type { ActionResult } from "@/features/admin/result";
import {
  confirmLessonAudio,
  createLesson,
  deleteLesson,
  moveLesson,
  startLessonAudioUpload,
  updateLesson,
  type LessonInput,
} from "@/features/admin/speaking";
import { saveDefaults } from "@/features/speaking/settings";
import type { TaskKey } from "@/features/speaking/tasks";

export async function createLessonAction(input: LessonInput) {
  await adminContext();
  return createLesson(input);
}

export async function updateLessonAction(id: string, input: LessonInput): Promise<ActionResult> {
  await adminContext();
  return updateLesson(id, input);
}

export async function deleteLessonAction(id: string): Promise<ActionResult> {
  await adminContext();
  return deleteLesson(id);
}

export async function moveLessonAction(id: string, dir: "up" | "down"): Promise<ActionResult> {
  await adminContext();
  return moveLesson(id, dir);
}

export async function startLessonAudioUploadAction(id: string, mime: string, size: number) {
  await adminContext();
  return startLessonAudioUpload(id, mime, size);
}

export async function confirmLessonAudioAction(id: string, key: string, durationSec: number): Promise<ActionResult> {
  await adminContext();
  return confirmLessonAudio(id, key, durationSec);
}

export async function saveDefaultsAction(targets: Record<TaskKey, number>): Promise<ActionResult> {
  await adminContext();
  return saveDefaults(targets);
}
