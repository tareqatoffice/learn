export class BodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message);
    this.name = "BodyError";
  }
}

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

export const IMPORT_BODY_MAX = 10_000_000;
