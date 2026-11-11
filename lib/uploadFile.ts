import { UploadError } from "@/lib/uploadTake";

const TIMEOUT_MS = 10 * 60_000;

/**
 * PUT a file to a presigned URL with progress (fetch can't report upload progress, XHR can).
 * A request that never gets a response is almost always the bucket's CORS policy refusing this
 * site's origin, so the error says so.
 */
export function putFile(url: string, file: File, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = TIMEOUT_MS;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new UploadError(`The upload failed (${xhr.status}). Try again.`, xhr.status));
      }
    };
    xhr.onerror = () =>
      reject(
        new UploadError(
          `The upload never reached storage. Check your connection. If you're online, the bucket's CORS policy probably doesn't allow ${
            typeof location === "undefined" ? "this site" : location.origin
          } (needs methods PUT, GET, HEAD and header Content-Type).`,
        ),
      );
    xhr.ontimeout = () => reject(new UploadError("The upload timed out. Try again."));
    xhr.send(file);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
