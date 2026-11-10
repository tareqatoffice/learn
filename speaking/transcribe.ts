import { Types } from "mongoose";
import { connectDb, retryOnDuplicateKey } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { SpeakingTake, SpeakingUsage } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";
import { getObjectBytes, headObject } from "@/lib/r2";
import { transcribe } from "@/lib/stt";

const MAX_BYTES = 25 * 1024 * 1024;
const LIMIT_MESSAGE = "You've reached today's transcription limit. It resets at midnight UTC.";
const isId = (id: unknown) => typeof id === "string" && Types.ObjectId.isValid(id);

/** Counts one transcription against the user's daily limit; returns a refund, or null when the limit is used up. */
async function consume(userId: string, limit: number, day: string): Promise<(() => Promise<void>) | null> {
  if (limit === 0) return async () => {};
  const row = await retryOnDuplicateKey(() =>
    SpeakingUsage.findOneAndUpdate({ userId, day }, { $inc: { count: 1 } }, { upsert: true, returnDocument: "after" }).lean<{
      count: number;
    }>(),
  );
  const refund = async () => {
    await SpeakingUsage.updateOne({ userId, day, count: { $gt: 0 } }, { $inc: { count: -1 } });
  };
  if ((row?.count ?? 0) > limit) {
    await refund();
    return null;
  }
  return refund;
}

export async function transcribeTake(
  userId: string,
  takeId: string,
  deps: { transcribe?: typeof transcribe } = {},
): Promise<ActionResult<{ transcript: string }>> {
  if (!isId(userId) || !isId(takeId)) return fail("Recording not found.");
  await connectDb();
  const take = await SpeakingTake.findOne({ _id: takeId, userId }).lean<{
    media: { key: string; audioKey?: string; stored: boolean };
    transcriptStatus?: string;
  }>();
  if (!take || !take.media.stored) return fail("Recording not found.");
  if (take.transcriptStatus !== "pending" && take.transcriptStatus !== "failed") {
    return fail("This recording can't be transcribed.");
  }

  const key = take.media.audioKey ?? take.media.key;
  const head = await headObject(key);
  if (!head || head.size <= 0) return fail("Recording not found.");
  if (head.size > MAX_BYTES) return fail("This recording is too large to transcribe.");

  const refund = await consume(userId, getEnv().STT_DAILY_LIMIT, new Date().toISOString().slice(0, 10));
  if (!refund) return fail(LIMIT_MESSAGE);

  const filter = { _id: takeId, userId, transcriptStatus: { $in: ["pending", "failed"] } };
  try {
    const bytes = await getObjectBytes(key);
    const transcript = await (deps.transcribe ?? transcribe)(bytes);
    const res = await SpeakingTake.updateOne(filter, { $set: { transcript, transcriptStatus: "done" } });
    if (!res.matchedCount) {
      await refund();
      return fail("This recording can't be transcribed.");
    }
    return ok({ transcript });
  } catch (error) {
    // Only the take id and the error message: never the audio bytes or the STT credentials.
    console.error(`Transcription failed for take ${takeId}: ${error instanceof Error ? error.message : String(error)}`);
    // Each step on its own, so a failed refund still marks the take failed (and neither can throw).
    for (const [what, step] of [
      ["refund the transcription", refund],
      ["mark the take failed", () => SpeakingTake.updateOne(filter, { $set: { transcriptStatus: "failed" } })],
    ] as const) {
      try {
        await step();
      } catch (cleanup) {
        console.error(`Couldn't ${what} for take ${takeId}: ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`);
      }
    }
    return fail("Couldn't transcribe the recording. Try again.");
  }
}
