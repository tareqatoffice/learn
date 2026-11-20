"use server";

import { adminContext } from "@/features/admin/action";
import {
  saveBook,
  saveQuestion,
  searchTopics,
  setQuestionTopicLink,
  type BookInput,
  type QuestionInput,
  type Result,
} from "@/features/admin/service";

export async function saveBookAction(input: BookInput): Promise<Result> {
  const user = await adminContext();
  return saveBook(input, user.email);
}

export async function saveQuestionAction(
  input: QuestionInput,
): Promise<Result> {
  const user = await adminContext();
  return saveQuestion(input, user.email);
}

export async function setQuestionTopicLinkAction(
  questionId: string,
  nodeId: string,
  linked: boolean,
): Promise<Result> {
  const user = await adminContext();
  return setQuestionTopicLink(questionId, nodeId, Boolean(linked), user.email);
}

export async function searchTopicsAction(
  query: string,
  subjects: string[],
): Promise<{ id: string; title: string; graphTitle: string }[]> {
  await adminContext();
  return searchTopics(
    String(query ?? "").slice(0, 100),
    Array.isArray(subjects) ? subjects.map(String).slice(0, 50) : [],
  );
}
