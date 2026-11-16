
const PREFERRED: Record<"audio" | "video", string[]> = {
  audio: ["audio/webm;codecs=opus", "audio/mp4"],
  video: ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"],
};

export function pickMime(
  kind: "audio" | "video",
  isSupported: (m: string) => boolean,
): string | null {
  return PREFERRED[kind].find((m) => isSupported(m)) ?? null;
}

export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

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

export async function grabFrames(
  video: HTMLVideoElement,
  count: number,
  maxWidth = 512,
): Promise<string[]> {
  if (count <= 0) return [];
  if (video.readyState < 1) await once(video, "loadedmetadata");
  if (video.readyState < 2) await once(video, "loadeddata");

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
