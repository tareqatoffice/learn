import { type ActionResult, fail, ok } from "@/features/admin/result";
import { deleteObjects, headObject, presignGet, presignPut, storageConfigured } from "@/lib/r2";
import { MEDIA_EXT, type MediaDoc, baseMime, capBytes, keysOf } from "./mediaCore";

const UPLOAD_FAILED = "Your recording didn't finish uploading. Try again.";
const MB = 1024 * 1024;
const tooLarge = (maxBytes: number) =>
  `This recording is larger than the ${Math.floor(maxBytes / MB)} MB limit for a take, so it can't be saved. Discard it and record a shorter take.`;
const isSize = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

export type PrepareUploadInput = {
  keyBase: string;
  kind: "audio" | "video";
  mime: string;
  audioMime?: string;
  size: number;
  audioSize?: number;
  capSec: number;
};

export async function prepareUpload(
  input: PrepareUploadInput,
): Promise<ActionResult<{ media: MediaDoc; uploadUrl: string; audioUploadUrl?: string; maxBytes: number }>> {
  if (!storageConfigured()) return fail("Recording storage isn't set up yet.");
  if (input.kind !== "audio" && input.kind !== "video") return fail("Unknown recording type.");

  const mime = baseMime(input.mime ?? "");
  const ext = MEDIA_EXT[mime];
  if (!ext || !mime.startsWith(`${input.kind}/`)) return fail("That recording format isn't supported.");

  const video = input.kind === "video";
  let audioMime: string | undefined;
  let audioExt: string | undefined;
  if (video) {
    audioMime = baseMime(input.audioMime ?? "audio/webm");
    audioExt = audioMime.startsWith("audio/") ? MEDIA_EXT[audioMime] : undefined;
    if (!audioExt) return fail("That recording format isn't supported.");
  }

  const maxBytes = capBytes(input.capSec, video);
  if (!isSize(input.size)) return fail("Invalid recording size.");
  if (input.size > maxBytes) return fail(tooLarge(maxBytes));
  if (video) {
    const audioMax = capBytes(input.capSec, false);
    if (!isSize(input.audioSize)) return fail("Invalid recording size.");
    if (input.audioSize > audioMax) return fail(tooLarge(audioMax));
  }

  const key = `${input.keyBase}.${ext}`;
  const audioKey = audioExt ? `${input.keyBase}.audio.${audioExt}` : undefined;
  const media: MediaDoc = { kind: input.kind, key, mime, audioKey, audioMime, durationSec: 0, capSec: input.capSec, stored: false };

  const uploadUrl = await presignPut(key, mime, input.size);
  const audioUploadUrl = audioKey && audioMime ? await presignPut(audioKey, audioMime, input.audioSize) : undefined;
  return ok({ media, uploadUrl, ...(audioUploadUrl ? { audioUploadUrl } : {}), maxBytes });
}

export async function verifyUpload(media: MediaDoc): Promise<{ ok: true; size: number } | { ok: false; error: string }> {
  const reject = async () => {
    try {
      await deleteObjects(keysOf(media));
    } catch (error) {
      console.error(`Couldn't remove the rejected upload ${media.key}`, error);
    }
    return { ok: false as const, error: UPLOAD_FAILED };
  };
  const wrongType = (stored: string, expected: string | undefined) => Boolean(stored) && baseMime(stored) !== baseMime(expected ?? "");
  const main = await headObject(media.key);
  if (!main || main.size <= 0 || main.size > capBytes(media.capSec, media.kind === "video")) return reject();
  if (wrongType(main.contentType, media.mime)) return reject();
  if (media.audioKey) {
    const audio = await headObject(media.audioKey);
    if (!audio || audio.size <= 0 || audio.size > capBytes(media.capSec, false)) return reject();
    if (wrongType(audio.contentType, media.audioMime)) return reject();
  }
  return { ok: true, size: main.size };
}

export async function playbackUrls(media: MediaDoc): Promise<{ url: string; audioUrl?: string } | null> {
  if (!media.stored) return null;
  const url = await presignGet(media.key);
  return media.audioKey ? { url, audioUrl: await presignGet(media.audioKey) } : { url };
}

export async function removeMedia(medias: MediaDoc[]): Promise<void> {
  await deleteObjects(medias.flatMap(keysOf));
}
