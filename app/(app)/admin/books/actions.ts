"use server";

import {
  saveBook,
  saveQuestion,
  searchTopics,
  setQuestionTopicLink,
  type BookInput,
  type QuestionInput,
  type Result,
} from "@/admin/service";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

export async function saveBookAction(input: BookInput): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return saveBook(input, user.email);
}

export async function saveQuestionAction(
  input: QuestionInput,
): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return saveQuestion(input, user.email);
}

export async function setQuestionTopicLinkAction(
  questionId: string,
  nodeId: string,
  linked: boolean,
): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return setQuestionTopicLink(questionId, nodeId, Boolean(linked), user.email);
}

export async function searchTopicsAction(
  query: string,
  subjects: string[],
): Promise<{ id: string; title: string; graphTitle: string }[]> {
  await requireAdmin();
  await connectDb();
  return searchTopics(
    String(query ?? "").slice(0, 100),
    Array.isArray(subjects) ? subjects.map(String).slice(0, 50) : [],
  );
}
