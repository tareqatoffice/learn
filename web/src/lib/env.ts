import { z } from "zod";

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
