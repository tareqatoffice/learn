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

export function uploadTake(
  url: string,
  blob: Blob,
  mime: string,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return putFile(url, blob, opts.onProgress, { contentType: mime, signal: opts.signal });
}
