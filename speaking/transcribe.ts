import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { SpeakingTake } from "@/models";
import { type ActionResult, fail } from "@/admin/result";
import type { MediaDoc } from "@/recording/mediaCore";
import { transcribeMedia } from "@/recording/transcribe";
import type { transcribe } from "@/lib/stt";

const isId = (id: unknown) => typeof id === "string" && Types.ObjectId.isValid(id);

export async function transcribeTake(
  userId: string,
  takeId: string,
  deps: { transcribe?: typeof transcribe } = {},
): Promise<ActionResult<{ transcript: string }>> {
  if (!isId(userId) || !isId(takeId)) return fail("Recording not found.");
  await connectDb();
  const take = await SpeakingTake.findOne({ _id: takeId, userId }).lean<{
    media: MediaDoc;
    transcriptStatus?: string;
  }>();
  if (!take || !take.media.stored) return fail("Recording not found.");
  if (take.transcriptStatus !== "pending" && take.transcriptStatus !== "failed") {
    return fail("This recording can't be transcribed.");
  }

  const filter = { _id: takeId, userId, transcriptStatus: { $in: ["pending", "failed"] } };
  return transcribeMedia(userId, take.media, {
    transcribe: deps.transcribe,
    label: `take ${takeId}`,
    save: async (transcript) => {
      const res = await SpeakingTake.updateOne(filter, { $set: { transcript, transcriptStatus: "done" } });
      return res.matchedCount > 0;
    },
    onError: async () => {
      await SpeakingTake.updateOne(filter, { $set: { transcriptStatus: "failed" } });
    },
  });
}
