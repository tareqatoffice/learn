import { putFile } from "@/lib/uploadFile";

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * PUT a recorded take to its presigned URL, through `putFile` (XHR: progress, a 10-minute timeout,
 * cancel by `signal`). `mime` must be the base type the URL was signed for (no codecs). Safe to call
 * again with the same blob after a failure, so a flaky connection never costs the learner their
 * recording.
 */
export function uploadTake(
  url: string,
  blob: Blob,
  mime: string,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return putFile(url, blob, opts.onProgress, { contentType: mime, signal: opts.signal });
}
