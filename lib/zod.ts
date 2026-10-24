import type { z } from "zod";

/** One readable line from a validation failure: `path: message` per issue, joined by "; ". */
export function issuesMessage(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}
