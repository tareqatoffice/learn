const UPLOAD_TIMEOUT_MS = 120_000;

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
 * PUT a recorded take to its presigned URL. `mime` must be the base type the URL was signed for
 * (no codecs). Safe to call again with the same blob after a failure, so a flaky connection never
 * costs the learner their recording.
 */
export async function uploadTake(
  url: string,
  blob: Blob,
  mime: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "PUT",
      headers: { "Content-Type": mime },
      body: blob,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch {
    throw new UploadError(
      "The upload failed. Check your connection and try again.",
    );
  }
  if (!res.ok)
    throw new UploadError(
      `The upload failed (${res.status}). Try again.`,
      res.status,
    );
}
