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

/**
 * Forgets the user's marks (status, seen count) for the given books, or for every book when
 * `bookIds` is empty. Quiz history is kept. Returns how many question records were removed.
 */
export async function clearQuestionProgress(userId: string, bookIds: string[]): Promise<number> {
  if (!isValidObjectId(userId)) return 0;
  const ids = bookIds.filter((id) => isValidObjectId(id));
  if (bookIds.length && !ids.length) return 0;
  const filter = ids.length ? { userId, bookId: { $in: ids } } : { userId };
  const { deletedCount } = await QuestionProgress.deleteMany(filter);
  return deletedCount ?? 0;
}
