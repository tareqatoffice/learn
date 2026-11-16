/** Bodies larger than a route allows are refused before they are read into memory. */
export class BodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message);
    this.name = "BodyError";
  }
}

/**
 * Reads a JSON request body of at most `maxBytes`: a declared Content-Length over the limit is refused
 * before reading, and so is an actual body that turns out longer (a missing or false header).
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyError(`The body is over the ${Math.round(maxBytes / 1_000_000)} MB limit`, 413);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new BodyError(`The body is over the ${Math.round(maxBytes / 1_000_000)} MB limit`, 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new BodyError("Body must be JSON", 400);
  }
}

/** The limit for content imports (a whole book or note series), shared by both import routes. */
export const IMPORT_BODY_MAX = 10_000_000;
