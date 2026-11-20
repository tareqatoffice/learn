import { runAdminImport } from "@/features/admin/import";
import { auth } from "@/auth";
import { isAdminEmail } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { BodyError, IMPORT_BODY_MAX, readJsonBody } from "@/lib/jsonBody";

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdminEmail(email)) return Response.json({ error: "Forbidden" }, { status: 403 });
  let body: { input?: unknown; dryRun?: unknown };
  try {
    body = (await readJsonBody(req, IMPORT_BODY_MAX)) as typeof body;
  } catch (error) {
    if (error instanceof BodyError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
  await connectDb();
  const result = await runAdminImport(body?.input, body?.dryRun !== false, email);
  return Response.json(result, { status: "error" in result ? 400 : 200, headers: { "Cache-Control": "no-store" } });
}
