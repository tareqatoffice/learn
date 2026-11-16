import type { z } from "zod";

export function issuesMessage(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}
