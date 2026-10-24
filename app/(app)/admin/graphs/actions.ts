"use server";

import { searchNotes, searchQuestions } from "@/admin/queries";
import {
  saveGraph,
  saveNode,
  setNodeNoteLink,
  setQuestionTopicLink,
  type GraphInput,
  type NodeInput,
  type Result,
} from "@/admin/service";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

export async function saveGraphAction(input: GraphInput): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return saveGraph(input, user.email);
}

export async function saveNodeAction(input: NodeInput): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return saveNode(input, user.email);
}

export async function setNodeQuestionLinkAction(nodeId: string, questionId: string, linked: boolean): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return setQuestionTopicLink(questionId, nodeId, Boolean(linked), user.email);
}

export async function setNodeNoteLinkAction(nodeId: string, noteId: string, anchor: string, linked: boolean): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return setNodeNoteLink(nodeId, noteId, String(anchor ?? ""), Boolean(linked), user.email);
}

export async function searchQuestionsAction(query: string, subjects: string[]): Promise<{ id: string; title: string }[]> {
  await requireAdmin();
  await connectDb();
  return searchQuestions(String(query ?? "").slice(0, 100), Array.isArray(subjects) ? subjects.map(String).slice(0, 50) : []);
}

export async function searchNotesAction(query: string): Promise<{ id: string; title: string; toc: { anchor: string; text: string }[] }[]> {
  await requireAdmin();
  await connectDb();
  return searchNotes(String(query ?? "").slice(0, 100));
}
