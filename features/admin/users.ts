import { isValidObjectId } from "mongoose";
import { z } from "zod";
import type { Result } from "@/features/admin/service";
import { BLOCK_REASON_MAX } from "@/features/auth/lib/access-limits";
import { isAdminEmail } from "@/features/auth/lib/authz";
import { deleteAllExerciseData } from "@/features/exercise/data";
import { deleteAllIeltsData } from "@/features/ielts/data";
import {
  AiConversation,
  AiUsage,
  CodingResult,
  FocusPlan,
  FocusReview,
  FocusSession,
  NodeProgress,
  NoteProgress,
  NoteRecitation,
  QuestionProgress,
  QuizSession,
  SpeakingDay,
  SpeakingProfile,
  SpeakingUsage,
  SpeakingTakeUsage,
  User,
} from "@/models";
import { deleteAllTakes } from "@/features/speaking/takes";


const input = z.object({
  id: z.string().refine((v) => isValidObjectId(v), "Invalid user id"),
  status: z.enum(["approved", "blocked"], { error: "Choose approve or block" }),
  reason: z
    .string()
    .trim()
    .max(BLOCK_REASON_MAX, `Keep the reason under ${BLOCK_REASON_MAX} characters`)
    .optional(),
});

export async function deleteUser(id: string): Promise<Result> {
  if (!isValidObjectId(id)) return { ok: false, errors: { _: "Invalid user id" } };
  const user = await User.findById(id, { email: 1 }).lean<{ email: string }>();
  if (!user) return { ok: false, errors: { _: "That user no longer exists." } };
  if (isAdminEmail(user.email)) return { ok: false, errors: { _: "Admins can't be deleted here. Remove them from ADMIN_EMAILS first." } };
  try {
    await deleteAllTakes(id);
    await deleteAllIeltsData(id);
  } catch {
    return { ok: false, errors: { _: "Couldn't delete the user's recordings from storage. Nothing else was removed; try again." } };
  }
  try {
    await deleteAllExerciseData(id);
  } catch {
    return { ok: false, errors: { _: "Couldn't delete the user's exercise data. Their recordings and IELTS data were already removed. Try again to finish deleting the user." } };
  }
  await Promise.all(
    [QuestionProgress, QuizSession, NodeProgress, NoteProgress, NoteRecitation, AiConversation, AiUsage, SpeakingUsage, SpeakingTakeUsage, SpeakingProfile, SpeakingDay, CodingResult, FocusSession, FocusReview, FocusPlan].map((M) =>
      M.deleteMany({ userId: id }),
    ),
  );
  await User.deleteOne({ _id: id });
  return { ok: true, id };
}

export async function setUserAccess(
  raw: { id: string; status: "approved" | "blocked"; reason?: string },
  adminEmail: string,
): Promise<Result> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: { _: parsed.error.issues[0].message } };
  const { id, status, reason } = parsed.data;

  const user = await User.findById(id, { email: 1 }).lean<{ email: string }>();
  if (!user) return { ok: false, errors: { _: "That user no longer exists." } };
  if (isAdminEmail(user.email)) {
    return { ok: false, errors: { _: "Admins always have access and can't be blocked." } };
  }

  const reviewed = { status, reviewedAt: new Date(), reviewedBy: adminEmail };
  const blockReason = status === "blocked" && reason ? { blockReason: reason } : null;
  await User.updateOne(
    { _id: id },
    blockReason ? { $set: { ...reviewed, ...blockReason } } : { $set: reviewed, $unset: { blockReason: 1 } },
  );
  return { ok: true, id };
}
