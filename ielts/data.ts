import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { IeltsBandEntry, IeltsPlan, IeltsPlanSuggestion, IeltsProfile, IeltsSpeakingAttempt, IeltsStudyLog } from "@/models";
import type { MediaDoc } from "@/recording/mediaCore";
import { removeMedia } from "@/recording/upload";

/**
 * Deletes every piece of a user's IELTS data: the R2 objects of their attempts' parts, then the attempts,
 * band entries, study logs, plan, suggestions and profile. Speaking Practice (takes, profile, usage) is
 * left alone; `deleteAllTakes` covers that. Throws on R2 failure, before any document is removed.
 */
export async function deleteAllIeltsData(userId: string): Promise<void> {
  if (!Types.ObjectId.isValid(userId)) return;
  await connectDb();
  const attempts = await IeltsSpeakingAttempt.find({ userId })
    .select("parts.media.key parts.media.audioKey")
    .lean<{ parts: { media: MediaDoc }[] }[]>();
  const medias = attempts.flatMap((a) => a.parts.map((p) => p.media));
  if (medias.length) await removeMedia(medias);
  await Promise.all(
    [IeltsSpeakingAttempt, IeltsBandEntry, IeltsStudyLog, IeltsPlanSuggestion, IeltsPlan, IeltsProfile].map((M) => M.deleteMany({ userId })),
  );
}
