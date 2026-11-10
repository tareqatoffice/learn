import { z } from "zod";

export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_DAILY_LIMIT = 100;
export const DEFAULT_STT_LIMIT = 200;

const schema = z.object({
  MONGODB_URI: z.string().min(1),
  AUTH_SECRET: z.string().default(""),
  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  AUTH_DEV_LOGIN: z
    .string()
    .default("false")
    .transform((value) => ["true", "1"].includes(value.trim().toLowerCase())),
  /** OpenRouter key for the AI quiz coach; blank turns the coach off. */
  OPENROUTER_API_KEY: z
    .string()
    .default("")
    .transform((value) => value.trim()),
  OPENROUTER_MODEL: z
    .string()
    .default("")
    .transform((value) => value.trim() || DEFAULT_OPENROUTER_MODEL),
  /**
   * Default AI calls (grades and follow-ups) per user per UTC day; 0 means no limit. An optional
   * feature must not take the site down, so a value that is not a whole number falls back to 100.
   */
  OPENROUTER_DAILY_LIMIT: z
    .string()
    .default("")
    .transform((value) => {
      const n = Number(value.trim() || DEFAULT_DAILY_LIMIT);
      return Number.isInteger(n) && n >= 0 ? n : DEFAULT_DAILY_LIMIT;
    }),
  /** Cloudflare R2 (speaking-practice audio). All four blank turns storage off. */
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default(""),
  /** Cloudflare Workers AI token for speech-to-text. */
  CF_AI_TOKEN: z.string().default(""),
  /** Speech-to-text calls per user per UTC day; a bad value falls back to DEFAULT_STT_LIMIT. */
  STT_DAILY_LIMIT: z
    .string()
    .default("")
    .transform((value) => {
      const n = Number(value.trim() || DEFAULT_STT_LIMIT);
      return Number.isInteger(n) && n >= 0 ? n : DEFAULT_STT_LIMIT;
    }),
});

export type Env = z.output<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ].join(", ");
    throw new Error(`Invalid environment variables: ${fields}`);
  }
  if (process.env.NODE_ENV === "production") {
    const missing = (["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] as const).filter(
      (key) => !result.data[key].trim(),
    );
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables in production: ${missing.join(", ")}`);
    }
  }
  cached = result.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
