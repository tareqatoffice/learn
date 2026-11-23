
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

export const MEDIA_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "audio/mp4": "m4a",
};

export const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();

export function keysOf(media: MediaDoc): string[] {
  return media.audioKey ? [media.key, media.audioKey] : [media.key];
}

export function capBytes(capSec: number, video: boolean): number {
  return capSec * (video ? 120_000 : 8_000);
}

// The recorder targets 48 kbps audio (6 KB/s), so even a take with long pauses stays well above
// 1 KB/s. A stated length the file is too small to hold is clamped to what it could hold.
const MIN_BYTES_PER_SEC = 1_000;

export function plausibleSec(bytes: number): number {
  return Math.max(1, Math.floor(bytes / MIN_BYTES_PER_SEC));
}
