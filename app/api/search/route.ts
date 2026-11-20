import { auth } from "@/auth";
import { searchContent } from "@/features/content/queries";
import { accessStatusFor } from "@/features/auth/lib/access";
import { connectDb } from "@/lib/db";
import { allow, LIMITS } from "@/lib/rateLimit";

const TERM_MAX = 100;

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) return new Response("Unauthorized", { status: 401 });
  const status = await accessStatusFor({ userId: user.id, email: user.email });
  if (!status) return new Response("Unauthorized", { status: 401 });
  if (status !== "approved") return new Response("Forbidden", { status: 403 });
  if (!(await allow(`search:${user.id ?? user.email}`, LIMITS.search))) {
    return new Response("Too many searches", { status: 429, headers: { "Retry-After": "60" } });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, TERM_MAX);
  await connectDb();
  const hits = await searchContent(q);
  return Response.json(
    { hits },
    { headers: { "Cache-Control": "no-store" } },
  );
}
