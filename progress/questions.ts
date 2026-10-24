import { isValidObjectId, type Types } from "mongoose";
import { retryOnDuplicateKey } from "@/lib/db";
import { Question, QuestionProgress } from "@/models";

export type MarkResult = "got" | "review" | "skip";

/**
 * Records one mark in a single upsert: every mark counts as seen; got/review set the
 * status, a skip keeps the previous status (null for a new doc). Two first marks racing
 * on the unique {userId, questionId} index can fail with E11000; the retry then updates.
 */
export async function markQuestion(userId: string, questionId: string, result: MarkResult): Promise<void> {
  const question = isValidObjectId(questionId)
    ? await Question.findById(questionId, { bookId: 1 }).lean<{ bookId: Types.ObjectId }>()
    : null;
  if (!question) throw new Error(`question ${questionId} not found`);

  const skip = result === "skip";
  const update = {
    $inc: { seenCount: 1 },
    $set: { lastSeenAt: new Date(), ...(skip ? {} : { status: result }) },
    $setOnInsert: { bookId: question.bookId, ...(skip ? { status: null } : {}) },
  };
  await retryOnDuplicateKey(() => QuestionProgress.updateOne({ userId, questionId }, update, { upsert: true }));
}
