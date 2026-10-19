import { z } from "zod";
import { runImport } from "@/content/import/run";
import { withToken } from "@/lib/tokenAuth";

const slug = z.string().regex(/^[a-z0-9-]+$/);
const MAX_TEXT = 3_000_000;

const body = z.object({
  target: z.object({ kind: z.enum(["book", "series", "graph"]), slug }),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("book"), markdown: z.string().max(MAX_TEXT) }),
    z.object({ kind: z.literal("series"), files: z.array(z.object({ name: z.string().max(200), content: z.string().max(MAX_TEXT) })).max(500) }),
    z.object({ kind: z.literal("graph"), json: z.unknown() }),
  ]),
  dryRun: z.boolean().optional(),
  publish: z.boolean().optional(),
  title: z.string().max(200).optional(),
  subjects: z.array(slug).max(50).optional(),
  description: z.string().max(MAX_TEXT).optional(),
});

/** POST an import; a dry run (the default) only reports. 400 when the report has errors. */
export function POST(req: Request): Promise<Response> {
  return withToken(req, async (token) => {
    let parsed: z.infer<typeof body>;
    try {
      parsed = body.parse(await req.json());
    } catch (error) {
      const message = error instanceof z.ZodError ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Body must be JSON";
      return Response.json({ error: message }, { status: 400 });
    }
    if (parsed.source.kind !== parsed.target.kind) {
      return Response.json({ error: "source.kind must match target.kind" }, { status: 400 });
    }
    const report = await runImport({ ...parsed, dryRun: parsed.dryRun ?? true, editedBy: `token:${token.name}` });
    return Response.json(report, { status: report.errors.length ? 400 : 200 });
  });
}
