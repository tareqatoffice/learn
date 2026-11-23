"use server";

import { adminContext } from "@/features/admin/action";
import {
  confirmPhoto,
  createExercise,
  deleteExercise,
  removePhoto,
  setExerciseArchived,
  startPhotoUpload,
  updateExercise,
  type CreateExerciseInput,
  type ExerciseInput,
  type PhotoSlot,
} from "@/features/admin/exercises";

export async function createExerciseAction(input: CreateExerciseInput) {
  await adminContext();
  return createExercise(input);
}

export async function updateExerciseAction(slug: string, input: ExerciseInput) {
  await adminContext();
  return updateExercise(slug, input);
}

export async function setExerciseArchivedAction(slug: string, archived: boolean) {
  await adminContext();
  return setExerciseArchived(slug, archived);
}

export async function deleteExerciseAction(slug: string) {
  await adminContext();
  return deleteExercise(slug);
}

export async function startPhotoUploadAction(slug: string, mime: string, size: number) {
  await adminContext();
  return startPhotoUpload(slug, mime, size);
}

export async function confirmPhotoAction(slug: string, slot: PhotoSlot, key: string) {
  await adminContext();
  return confirmPhoto(slug, slot, key);
}

export async function removePhotoAction(slug: string, slot: PhotoSlot) {
  await adminContext();
  return removePhoto(slug, slot);
}
