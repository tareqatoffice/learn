import { z } from "zod";
import { runImport } from "@/content/import/run";
import { importFields } from "@/content/import/schema";
import { withToken } from "@/lib/tokenAuth";
import { issuesMessage } from "@/lib/zod";

const body = z.object({
  ...importFields,
  dryRun: z.boolean().optional(),
  publish: z.boolean().optional(),
});

/** POST an import; a dry run (the default) only reports. 400 when the report has errors. */
export function POST(req: Request): Promise<Response> {
  return withToken(req, async (token) => {
    let parsed: z.infer<typeof body>;
    try {
      parsed = body.parse(await req.json());
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? issuesMessage(error)
          : "Body must be JSON";
      return Response.json({ error: message }, { status: 400 });
    }
    if (parsed.source.kind !== parsed.target.kind) {
      return Response.json(
        { error: "source.kind must match target.kind" },
        { status: 400 },
      );
    }
    const report = await runImport({
      ...parsed,
      dryRun: parsed.dryRun ?? true,
      editedBy: `token:${token.name}`,
    });
    return Response.json(report, { status: report.errors.length ? 400 : 200 });
  });
}
