import { putFile } from "@/lib/uploadFile";

export { UploadError } from "@/lib/uploadFile";

export function uploadTake(
  url: string,
  blob: Blob,
  mime: string,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return putFile(url, blob, opts.onProgress, { contentType: mime, signal: opts.signal });
}
