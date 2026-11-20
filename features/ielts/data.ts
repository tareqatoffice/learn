import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import {
  IeltsBandEntry,
  IeltsPlan,
  IeltsPlanSuggestion,
  IeltsProfile,
  IeltsSpeakingAttempt,
  IeltsStudyLog,
  IeltsTestAttempt,
  IeltsWritingAttempt,
} from "@/models";
import type { MediaDoc } from "@/features/recording/mediaCore";
import { removeMedia } from "@/features/recording/upload";

export async function deleteAllIeltsData(userId: string): Promise<void> {
  if (!Types.ObjectId.isValid(userId)) return;
  await connectDb();
  const attempts = await IeltsSpeakingAttempt.find({ userId })
    .select("parts.media.key parts.media.audioKey")
    .lean<{ parts: { media: MediaDoc }[] }[]>();
  const medias = attempts.flatMap((a) => a.parts.map((p) => p.media));
  if (medias.length) await removeMedia(medias);
  await Promise.all(
    [IeltsSpeakingAttempt, IeltsTestAttempt, IeltsWritingAttempt, IeltsBandEntry, IeltsStudyLog, IeltsPlanSuggestion, IeltsPlan, IeltsProfile].map(
      (M) => M.deleteMany({ userId }),
    ),
  );
}
