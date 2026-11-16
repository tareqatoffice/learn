import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/ids";

const MAX_TEXT = 3_000_000;

export const slugSchema = z.string().regex(SLUG_PATTERN, "Slug: lowercase letters, digits and dashes");

export const importFields = {
  target: z.object({ kind: z.enum(["book", "series", "graph"]), slug: slugSchema }),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("book"), markdown: z.string().max(MAX_TEXT) }),
    z.object({ kind: z.literal("series"), files: z.array(z.object({ name: z.string().max(200), content: z.string().max(MAX_TEXT) })).max(500) }),
    z.object({
      kind: z.literal("graph"),
      json: z.unknown().refine((v) => (JSON.stringify(v) ?? "").length <= MAX_TEXT, "The graph JSON is too large"),
    }),
  ]),
  title: z.string().max(200).optional(),
  subjects: z.array(slugSchema).max(50).optional(),
  description: z.string().max(MAX_TEXT).optional(),
};
