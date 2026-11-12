// Client-safe media helpers (no mongoose), so client components can share the upload size rule.
// `recording/media.ts` re-exports all of this beside the schemas.

export type MediaDoc = {
  kind: "audio" | "video";
  key: string;
  mime: string;
  audioKey?: string;
  audioMime?: string;
  durationSec: number;
  capSec: number;
  size?: number;
  stored: boolean;
};

/** File extension for each supported recording mime (without parameters). */
export const MEDIA_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "audio/mp4": "m4a",
};

/** Lower-cased mime without parameters (e.g. `;codecs=opus`). */
export const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();

/** The R2 keys a recording occupies: the main object, plus the audio-only copy of a video. */
export function keysOf(media: MediaDoc): string[] {
  return media.audioKey ? [media.key, media.audioKey] : [media.key];
}

/** Upload size ceiling: 8 kB/s audio, 120 kB/s video. */
export function capBytes(capSec: number, video: boolean): number {
  return capSec * (video ? 120_000 : 8_000);
}
