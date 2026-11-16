import { retryOnDuplicateKey } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getObjectBytes, headObject } from "@/lib/r2";
import { SttError, transcribe } from "@/lib/stt";
import { SpeakingUsage } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";
import type { MediaDoc } from "./mediaCore";

const MAX_BYTES = 25 * 1024 * 1024;
/** Transcriptions one recording may use, counting failures that reached speech-to-text. */
export const MAX_TRANSCRIBE_ATTEMPTS = 3;
/** A transcription claimed longer ago than this is treated as abandoned and can be taken over. */
export const STALE_TRANSCRIBE_MS = 5 * 60 * 1000;
export const TRANSCRIBE_ATTEMPTS_MESSAGE = "This recording couldn't be transcribed after several tries. Record it again to get a transcript.";
export const TRANSCRIBE_LIMIT_MESSAGE = "You've reached today's transcription limit. It resets at midnight UTC.";

/**
 * Counts one transcription against the user's shared daily limit (`STT_DAILY_LIMIT`, any module);
 * returns a refund, or null when the limit is used up.
 */
export async function consumeTranscription(userId: string, now: Date = new Date()): Promise<(() => Promise<void>) | null> {
  const limit = getEnv().STT_DAILY_LIMIT;
  if (limit === 0) return async () => {};
  const day = now.toISOString().slice(0, 10);
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

/**
 * Transcribes a stored recording's audio: size check, daily cap, fetch, STT. A failure is refunded only
 * when speech-to-text never answered (network error, timeout, or the audio couldn't be fetched): once
 * the service has replied, the call counts, so repeated retries can't run past the daily cap.
 * Writes nothing itself; callers persist through the optional hooks, which run inside the job:
 * `save` returns false when the transcript can't be stored (the count is refunded), `onError` runs
 * after a failed transcription (e.g. to mark the record failed).
 */
export async function transcribeMedia(
  userId: string,
  media: MediaDoc,
  deps: {
    transcribe?: typeof transcribe;
    save?: (transcript: string) => Promise<boolean>;
    onError?: () => Promise<void>;
    /** Names the recording in server logs, e.g. `take 123`. */
    label?: string;
  } = {},
): Promise<ActionResult<{ transcript: string }>> {
  const label = deps.label ?? "recording";
  const key = media.audioKey ?? media.key;
  const head = await headObject(key);
  if (!head || head.size <= 0) return fail("Recording not found.");
  if (head.size > MAX_BYTES) return fail("This recording is too large to transcribe.");

  const refund = await consumeTranscription(userId);
  if (!refund) return fail(TRANSCRIBE_LIMIT_MESSAGE);

  try {
    const bytes = await getObjectBytes(key);
    const transcript = await (deps.transcribe ?? transcribe)(bytes);
    if (deps.save && !(await deps.save(transcript))) {
      await refund();
      return fail("This recording can't be transcribed.");
    }
    return ok({ transcript });
  } catch (error) {
    // Only the label and the error message: never the audio bytes or the STT credentials.
    console.error(`Transcription failed for ${label}: ${error instanceof Error ? error.message : String(error)}`);
    const answered = error instanceof SttError && error.reached;
    // Each step on its own, so a failed refund still marks the record failed (and neither can throw).
    for (const [what, step] of [
      ["refund the transcription", answered ? async () => {} : refund],
      ["mark the recording failed", deps.onError ?? (async () => {})],
    ] as const) {
      try {
        await step();
      } catch (cleanup) {
        console.error(`Couldn't ${what} for ${label}: ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`);
      }
    }
    return fail("Couldn't transcribe the recording. Try again.");
  }
}
