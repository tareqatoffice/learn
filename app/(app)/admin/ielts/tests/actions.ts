"use server";

import { adminContext } from "@/admin/action";
import {
  confirmPromptImage,
  confirmSectionAudio,
  deletePrompt,
  deleteTest,
  generatePromptDraft,
  generateTestDraft,
  savePrompt,
  saveTest,
  setPromptStatus,
  setTestStatus,
  startPromptImageUpload,
  startSectionAudioUpload,
  type PromptInput,
  type PublishStatus,
  type TestInput,
  type TestKind,
} from "@/admin/ieltsTests";

// Shared by the Reading & Listening pages and the Writing pages.

export async function saveTestAction(kind: TestKind, id: string | null, input: TestInput) {
  await adminContext();
  return saveTest(kind, id, input);
}

export async function deleteTestAction(kind: TestKind, id: string) {
  await adminContext();
  return deleteTest(kind, id);
}

export async function setTestStatusAction(kind: TestKind, id: string, status: PublishStatus) {
  await adminContext();
  return setTestStatus(kind, id, status);
}

export async function generateTestDraftAction(kind: TestKind) {
  const { userId } = await adminContext();
  return generateTestDraft(userId, kind);
}

export async function startSectionAudioUploadAction(id: string, index: number, mime: string, size: number) {
  await adminContext();
  return startSectionAudioUpload(id, index, mime, size);
}

export async function confirmSectionAudioAction(id: string, index: number, key: string, durationSec: number) {
  await adminContext();
  return confirmSectionAudio(id, index, key, durationSec);
}

export async function savePromptAction(id: string | null, input: PromptInput) {
  await adminContext();
  return savePrompt(id, input);
}

export async function deletePromptAction(id: string) {
  await adminContext();
  return deletePrompt(id);
}

export async function setPromptStatusAction(id: string, status: PublishStatus) {
  await adminContext();
  return setPromptStatus(id, status);
}

export async function generatePromptDraftAction(task: "task1" | "task2") {
  const { userId } = await adminContext();
  return generatePromptDraft(userId, task);
}

export async function startPromptImageUploadAction(id: string, mime: string, size: number) {
  await adminContext();
  return startPromptImageUpload(id, mime, size);
}

export async function confirmPromptImageAction(id: string, key: string) {
  await adminContext();
  return confirmPromptImage(id, key);
}
