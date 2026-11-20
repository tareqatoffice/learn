export const OPENROUTER_API = "https://openrouter.ai/api/v1";
export const OPENROUTER_URL = `${OPENROUTER_API}/chat/completions`;

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

export class AiError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
    readonly reached = false,
  ) {
    super(message);
  }
}

export type ChatOptions = {
  apiKey: string;
  models: string[];
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  accept?: (text: string) => boolean;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export type ChatReply = { text: string; model: string };

class AttemptError extends Error {
  constructor(
    message: string,
    readonly final = false,
    readonly detail?: string,
    readonly reached = true,
  ) {
    super(message);
  }
}

export function errorDetail(status: number, body: string): string {
  let reason = "";
  try {
    const error = (JSON.parse(body) as { error?: { message?: unknown; metadata?: { raw?: unknown } } }).error;
    const raw = error?.metadata?.raw;
    reason = [error?.message, typeof raw === "string" ? raw : undefined]
      .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
      .join(": ");
  } catch {
    reason = body.trim();
  }
  return `HTTP ${status}${reason ? ` · ${reason.slice(0, 300)}` : ""}`;
}

const STATUS_MESSAGES: Record<number, string> = {
  402: "The AI coach is unavailable (the OpenRouter account is out of credits).",
  429: "The AI coach is busy right now. Try again shortly.",
};

async function attempt(model: string, messages: ChatMessage[], options: ChatOptions, key: string): Promise<string> {
  const body = {
    model,
    messages,
    max_tokens: options.maxTokens ?? 800,
    temperature: options.temperature ?? 0.2,
    reasoning: { effort: "low" },
    ...(options.jsonSchema
      ? { response_format: { type: "json_schema", json_schema: { ...options.jsonSchema, strict: true } } }
      : {}),
  };

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Learn" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
    });
  } catch (error) {
    console.error(`OpenRouter request to ${model} failed: ${error instanceof Error ? error.name : "unknown error"}`);
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new AttemptError("The AI coach could not be reached. Try again.", false, timedOut ? "Timed out" : "Network error", false);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`OpenRouter error from ${model}: status ${response.status}, ${body.length} bytes`);
    const detail = errorDetail(response.status, body);
    if (response.status === 401)
      throw new AttemptError("The AI coach is misconfigured (the OpenRouter key was rejected).", true, detail);
    throw new AttemptError(STATUS_MESSAGES[response.status] ?? "The AI coach failed. Try again.", false, detail);
  }

  const data = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
    choices?: { finish_reason?: unknown; message?: { content?: unknown } }[];
  } | null;
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error(`OpenRouter returned no content from ${model}: finish_reason ${String(choice?.finish_reason ?? "unknown")}`);
    const reason =
      typeof data?.error?.message === "string"
        ? data.error.message.slice(0, 300)
        : `finish_reason ${String(choice?.finish_reason ?? "unknown")}`;
    throw new AttemptError("The AI coach returned an empty reply. Try again.", false, `Empty reply (${reason})`);
  }
  const text = content.trim();
  if (options.accept && !options.accept(text)) {
    console.error(`Unusable reply from ${model}: ${text.length} chars, finish_reason ${String(choice?.finish_reason ?? "unknown")}`);
    throw new AttemptError(
      "The AI coach gave an unreadable reply. Try again.",
      false,
      `Reply was not in the expected format (finish_reason ${String(choice?.finish_reason ?? "unknown")}): ${text.slice(0, 120)}`,
    );
  }
  return text;
}

export async function chatCompletion(messages: ChatMessage[], options: ChatOptions): Promise<ChatReply> {
  const key = options.apiKey;
  if (!key) throw new AiError("The AI coach is not configured.");
  const models = [...new Set(options.models.filter(Boolean))];
  if (!models.length) throw new AiError("No AI model is selected.");

  let last: AttemptError | undefined;
  let reached = false;
  for (const model of models) {
    try {
      return { text: await attempt(model, messages, options, key), model };
    } catch (error) {
      if (!(error instanceof AttemptError)) throw error;
      last = error;
      reached ||= error.reached;
      if (error.final) break;
    }
  }
  throw new AiError(last?.message ?? "The AI coach failed. Try again.", last?.detail, reached);
}

export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export type CatalogModel = {
  id: string;
  name: string;
  free: boolean;
  contextLength: number | null;
  json: boolean | null;
  images: boolean;
};

const CATALOG_TTL_MS = 10 * 60 * 1000;
let catalogCache: { at: number; models: CatalogModel[] } | undefined;

export const resetCatalogCache = () => {
  catalogCache = undefined;
};

type RawModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
  architecture?: { output_modalities?: unknown; input_modalities?: unknown };
  supported_parameters?: unknown;
};

function supportsJson(params: unknown): boolean | null {
  if (!Array.isArray(params)) return null;
  return params.includes("structured_outputs") || params.includes("response_format");
}

const isZero = (price: unknown) => typeof price === "string" && Number(price) === 0 && price.trim() !== "";

export function parseCatalog(data: unknown): CatalogModel[] {
  const rows = (data as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return [];
  return (rows as RawModel[])
    .filter((m): m is RawModel & { id: string } => typeof m.id === "string" && Boolean(m.id))
    .filter((m) => {
      const out = m.architecture?.output_modalities;
      if (!Array.isArray(out) || m.id.startsWith("openrouter/")) return true;
      return out.includes("text") && out.every((o) => o === "text");
    })
    .map((m) => ({
      id: m.id,
      name: typeof m.name === "string" && m.name ? m.name : m.id,
      free: m.id.endsWith(":free") || (isZero(m.pricing?.prompt) && isZero(m.pricing?.completion)),
      contextLength: typeof m.context_length === "number" ? m.context_length : null,
      json: supportsJson(m.supported_parameters),
      images: Array.isArray(m.architecture?.input_modalities) && m.architecture.input_modalities.includes("image"),
    }))
    .sort(
      (a, b) =>
        Number(b.free) - Number(a.free) ||
        Number(b.json === true) - Number(a.json === true) ||
        a.name.localeCompare(b.name),
    );
}

export async function listCatalog(
  options: { apiKey?: string; fetch?: typeof fetch; now?: number } = {},
): Promise<{ models: CatalogModel[]; error?: string }> {
  const now = options.now ?? Date.now();
  if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) return { models: catalogCache.models };
  try {
    const key = options.apiKey;
    const response = await (options.fetch ?? fetch)(`${OPENROUTER_API}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const models = parseCatalog(await response.json());
    if (!models.length) throw new Error("empty model list");
    catalogCache = { at: now, models };
    return { models };
  } catch (error) {
    console.error("Could not load the OpenRouter model list", error);
    return { models: [], error: "Could not load OpenRouter's model list. You can still type a model id." };
  }
}

export type ModelCheck = { model: string; ok: boolean; ms: number; error?: string };

const CHECK_SCHEMA = {
  name: "check",
  schema: {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
    additionalProperties: false,
  },
};

export async function checkModels(
  models: string[],
  options: { apiKey: string; fetch?: typeof fetch },
): Promise<ModelCheck[]> {
  const results: ModelCheck[] = [];
  for (const model of models) {
    const started = Date.now();
    try {
      await chatCompletion([{ role: "user", content: 'Reply with the JSON object {"ok": true}.' }], {
        ...options,
        models: [model],
        maxTokens: 1000,
        timeoutMs: 20_000,
        jsonSchema: CHECK_SCHEMA,
        accept: (t) => extractJson(t) !== null,
      });
      results.push({ model, ok: true, ms: Date.now() - started });
    } catch (error) {
      results.push({
        model,
        ok: false,
        ms: Date.now() - started,
        error: error instanceof AiError ? (error.detail ? `${error.message} (${error.detail})` : error.message) : "Failed",
      });
    }
  }
  return results;
}

export type KeyCheck =
  | { status: "valid"; label?: string; freeTier?: boolean }
  | { status: "rejected" }
  | { status: "unverified" };

export async function verifyKey(apiKey: string, options: { fetch?: typeof fetch } = {}): Promise<KeyCheck> {
  try {
    const response = await (options.fetch ?? fetch)(`${OPENROUTER_API}/key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 403) return { status: "rejected" };
    if (!response.ok) return { status: "unverified" };
    const data = ((await response.json().catch(() => null)) as { data?: { label?: unknown; is_free_tier?: unknown } } | null)?.data;
    return {
      status: "valid",
      ...(typeof data?.label === "string" && data.label ? { label: data.label } : {}),
      ...(typeof data?.is_free_tier === "boolean" ? { freeTier: data.is_free_tier } : {}),
    };
  } catch (error) {
    console.error("Could not verify the OpenRouter key", error);
    return { status: "unverified" };
  }
}
