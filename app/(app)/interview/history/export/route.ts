import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { attemptsMarkdown, exportFileName, getAttemptLogs } from "@/progress/attempts";

/**
 * The signed-in user's quiz attempts as a Markdown download: one session with `?session=<id>`,
 * otherwise every recent session. Only the user's own sessions are ever read.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in first", { status: 401 });
  await connectDb();

  const sessionId = new URL(request.url).searchParams.get("session") ?? undefined;
  const logs = await getAttemptLogs(userId, sessionId);
  if (sessionId && !logs.length) return new Response("Not found", { status: 404 });

  const now = new Date();
  const name = exportFileName(sessionId ? logs[0].label : null, now);
  return new Response(attemptsMarkdown(logs, now), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
