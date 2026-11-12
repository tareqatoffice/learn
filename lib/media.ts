// Browser media helpers: container choice, file extensions and video frame grabbing.
// Pure and DOM-light so they can be tested without a real camera.

const PREFERRED: Record<"audio" | "video", string[]> = {
  audio: ["audio/webm;codecs=opus", "audio/mp4"],
  video: ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"],
};

/** First container the browser can record, in preference order (Chrome: webm; iOS Safari: mp4). */
export function pickMime(
  kind: "audio" | "video",
  isSupported: (m: string) => boolean,
): string | null {
  return PREFERRED[kind].find((m) => isSupported(m)) ?? null;
}

/** Mime type without parameters, e.g. "audio/webm;codecs=opus" -> "audio/webm". */
export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

/** File extension for a recorded mime type; accepts the full recorder string or the base type. */
export function extFor(mime: string): "webm" | "mp4" | "m4a" {
  const base = baseMime(mime);
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/aac")
    return "m4a";
  if (base.endsWith("/mp4")) return "mp4";
  return "webm";
}

function once(
  target: EventTarget,
  event: string,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      target.removeEventListener(event, done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    target.addEventListener(event, done);
  });
}

/**
 * Evenly spaced JPEG snapshots (data URLs, quality 0.7, at most `maxWidth` wide) of a loaded
 * video, for the vision coach. Seeks the element, so pass a playback copy of the take.
 */
export async function grabFrames(
  video: HTMLVideoElement,
  count: number,
  maxWidth = 512,
): Promise<string[]> {
  if (count <= 0) return [];
  // The video must be same-origin or a blob: URL, or drawing it taints the canvas and toDataURL throws.
  if (video.readyState < 1) await once(video, "loadedmetadata");
  // Drawing needs a decoded frame, not just metadata.
  if (video.readyState < 2) await once(video, "loadeddata");

  // MediaRecorder webm files report an infinite duration until the end has been seeked to.
  if (!Number.isFinite(video.duration)) {
    const known = once(video, "durationchange");
    const atEnd = once(video, "seeked", 1000);
    video.currentTime = 1e101;
    await known;
    await atEnd;
    const back = once(video, "seeked", 1000);
    video.currentTime = 0;
    await back;
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 0;

  const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(
    1,
    Math.round((video.videoWidth || maxWidth) * scale),
  );
  canvas.height = Math.max(
    1,
    Math.round((video.videoHeight || (maxWidth * 3) / 4) * scale),
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const seeked = once(video, "seeked");
    video.currentTime = (duration * (i + 0.5)) / count;
    await seeked;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.7));
  }
  return frames;
}

const FRAME_COUNT = 5;

/** Five evenly spaced stills of a recording, read from a same-origin blob copy so the canvas isn't tainted. */
export async function framesOf(mediaUrl: string): Promise<string[]> {
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    video.load();
    return await grabFrames(video, FRAME_COUNT);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
