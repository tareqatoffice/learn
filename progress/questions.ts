import { isValidObjectId, type ClientSession, type Types } from "mongoose";
import { retryOnDuplicateKey } from "@/lib/db";
import { Question, QuestionProgress } from "@/models";

export type MarkResult = "got" | "review" | "skip";

export async function markQuestion(
  userId: string,
  questionId: string,
  result: MarkResult,
  opts: { session?: ClientSession } = {},
): Promise<void> {
  const question = isValidObjectId(questionId)
    ? await Question.findById(questionId, { bookId: 1 }, { session: opts.session }).lean<{ bookId: Types.ObjectId }>()
    : null;
  if (!question) throw new Error(`question ${questionId} not found`);
  if (result === "skip") return;

  const update = {
    $inc: { seenCount: 1 },
    $set: { lastSeenAt: new Date(), status: result },
    $setOnInsert: { bookId: question.bookId },
  };
  await retryOnDuplicateKey(() => QuestionProgress.updateOne({ userId, questionId }, update, { upsert: true, session: opts.session }));
}

export async function clearQuestionProgress(userId: string, bookIds: string[]): Promise<number> {
  if (!isValidObjectId(userId)) return 0;
  const ids = bookIds.filter((id) => isValidObjectId(id));
  if (bookIds.length && !ids.length) return 0;
  const filter = ids.length ? { userId, bookId: { $in: ids } } : { userId };
  const { deletedCount } = await QuestionProgress.deleteMany(filter);
  return deletedCount ?? 0;
}
