import { searchContent } from "@/features/content/queries";
import { approvedRouteUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { allow, LIMITS } from "@/lib/rateLimit";

const TERM_MAX = 100;

export async function GET(request: Request): Promise<Response> {
  const access = await approvedRouteUser();
  if ("response" in access) return access.response;
  const { user } = access;
  if (!(await allow(`search:${user.userId}`, LIMITS.search))) {
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
