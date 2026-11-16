import { auth } from "@/auth";
import { searchContent } from "@/content/queries";
import { accessStatusFor } from "@/lib/access";
import { connectDb } from "@/lib/db";

/** Longer terms are the user leaning on the keyboard; the query only ever matches titles. */
const TERM_MAX = 100;

/**
 * Title search for the command palette. The proxy has already turned away anyone who is not signed
 * in and approved; the checks here are what stop a 200 if that policy or its matcher ever changes.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) return new Response("Unauthorized", { status: 401 });
  const status = await accessStatusFor({ userId: user.id, email: user.email });
  if (!status) return new Response("Unauthorized", { status: 401 });
  if (status !== "approved") return new Response("Forbidden", { status: 403 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, TERM_MAX);
  await connectDb();
  const hits = await searchContent(q);
  return Response.json(
    { hits },
    // Per user and short-lived: the palette re-queries as the user types, and published content
    // can change under them.
    { headers: { "Cache-Control": "no-store" } },
  );
}
