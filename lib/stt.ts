import { getEnv } from "@/lib/env";

const MODEL = "@cf/openai/whisper-large-v3-turbo";

export class SttError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SttError";
  }
}

export function sttConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.R2_ACCOUNT_ID && env.CF_AI_TOKEN);
}

export async function transcribe(
  audio: Uint8Array,
  options: { fetch?: typeof fetch } = {},
): Promise<string> {
  const env = getEnv();
  const doFetch = options.fetch ?? fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/ai/run/${MODEL}`;
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio: Buffer.from(audio).toString("base64") }),
    });
  } catch (error) {
    throw new SttError(`Speech-to-text request failed: ${(error as Error).message}`);
  }
  if (!res.ok) throw new SttError(`Speech-to-text failed with status ${res.status}`);
  const data = (await res.json().catch(() => null)) as { result?: { text?: unknown } } | null;
  const text = data?.result?.text;
  if (typeof text !== "string") throw new SttError("Speech-to-text returned no text");
  return text.trim();
}
