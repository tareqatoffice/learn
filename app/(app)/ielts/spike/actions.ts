"use server";

// TEMPORARY (phone spike). Remove with the rest of app/(app)/ielts/spike.
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getObjectBytes } from "@/lib/r2";
import { SpeakingTake } from "@/models";
import { getTake } from "@/speaking/takes";

export async function spikePlaybackAction(takeId: string) {
  const user = await requireUser();
  await connectDb();
  const take = await getTake(user.userId, takeId);
  if (!take) return { ok: false as const, error: "take not found" };
  return { ok: true as const, mediaUrl: take.mediaUrl, audioUrl: take.audioUrl ?? null, mime: take.mime };
}

/** Calls Whisper directly (lib/stt.ts only keeps the text) and returns the response shape. No take state changes. */
export async function spikeSttShapeAction(takeId: string) {
  const user = await requireUser();
  await connectDb();
  const take = await SpeakingTake.findOne({ _id: takeId, userId: user.userId }).lean<{
    media: { key: string; audioKey?: string };
  }>();
  if (!take) return { ok: false as const, error: "take not found" };
  const env = getEnv();
  if (!env.R2_ACCOUNT_ID || !env.CF_AI_TOKEN) return { ok: false as const, error: "STT not configured" };
  const bytes = await getObjectBytes(take.media.audioKey ?? take.media.key);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/ai/run/@cf/openai/whisper-large-v3-turbo`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CF_AI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ audio: Buffer.from(bytes).toString("base64") }),
    },
  );
  const json = (await res.json().catch(() => null)) as { result?: Record<string, unknown> } | null;
  const result = json?.result ?? {};
  const words = result.words as unknown[] | undefined;
  const segments = result.segments as unknown[] | undefined;
  const firstSegment = segments?.[0] as Record<string, unknown> | undefined;
  return {
    ok: res.ok,
    status: res.status,
    resultKeys: Object.keys(result),
    hasWordTimestamps: Array.isArray(words) && words.length > 0,
    hasSegmentTimestamps: Array.isArray(segments) && segments.length > 0,
    wordCount: words?.length ?? 0,
    segmentCount: segments?.length ?? 0,
    firstWord: words?.[0] ?? null,
    firstSegmentKeys: firstSegment ? Object.keys(firstSegment) : null,
    firstSegment: firstSegment ? { ...firstSegment, words: undefined } : null,
    textPreview: typeof result.text === "string" ? result.text.slice(0, 120) : null,
  };
}
