import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { SpeakingTake } from "@/models";
import { type ActionResult, fail } from "@/admin/result";
import type { MediaDoc } from "@/recording/mediaCore";
import { MAX_TRANSCRIBE_ATTEMPTS, STALE_TRANSCRIBE_MS, TRANSCRIBE_ATTEMPTS_MESSAGE, transcribeMedia } from "@/recording/transcribe";
import { sttConfigured, type transcribe } from "@/lib/stt";

const isId = (id: unknown) => typeof id === "string" && Types.ObjectId.isValid(id);

export async function transcribeTake(
  userId: string,
  takeId: string,
  deps: { transcribe?: typeof transcribe; now?: Date } = {},
): Promise<ActionResult<{ transcript: string }>> {
  if (!isId(userId) || !isId(takeId)) return fail("Recording not found.");
  await connectDb();
  const take = await SpeakingTake.findOne({ _id: takeId, userId }).lean<{
    media: MediaDoc;
    transcriptStatus?: string;
    transcribeAttempts?: number;
  }>();
  if (!take || !take.media.stored) return fail("Recording not found.");
  const retryable = ["pending", "failed", "running", ...(sttConfigured() ? ["unavailable"] : [])];
  if (!retryable.includes(take.transcriptStatus ?? "")) {
    return fail("This recording can't be transcribed.");
  }
  if ((take.transcribeAttempts ?? 0) >= MAX_TRANSCRIBE_ATTEMPTS) return fail(TRANSCRIBE_ATTEMPTS_MESSAGE);

  const now = deps.now ?? new Date();
  const claim = await SpeakingTake.updateOne(
    {
      _id: takeId,
      userId,
      "media.stored": true,
      transcribeAttempts: { $not: { $gte: MAX_TRANSCRIBE_ATTEMPTS } },
      $or: [
        { transcriptStatus: { $in: retryable.filter((s) => s !== "running") } },
        { transcriptStatus: "running", transcribeStartedAt: { $lt: new Date(now.getTime() - STALE_TRANSCRIBE_MS) } },
      ],
    },
    { $set: { transcriptStatus: "running", transcribeStartedAt: now }, $inc: { transcribeAttempts: 1 } },
  );
  if (!claim.matchedCount) return fail("This recording is already being transcribed. Reload the page in a minute.");

  const ours = { _id: takeId, userId, transcriptStatus: "running", transcribeStartedAt: now };
  const before = take.transcriptStatus === "failed" ? "failed" : "pending";
  const res = await transcribeMedia(userId, take.media, {
    transcribe: deps.transcribe,
    label: `take ${takeId}`,
    save: async (transcript) => {
      const saved = await SpeakingTake.updateOne(ours, { $set: { transcript, transcriptStatus: "done" } });
      return saved.matchedCount > 0;
    },
    onError: async () => {
      await SpeakingTake.updateOne(ours, { $set: { transcriptStatus: "failed" } });
    },
  });
  if (!res.ok) await SpeakingTake.updateOne(ours, { $set: { transcriptStatus: before }, $inc: { transcribeAttempts: -1 } });
  return res;
}
