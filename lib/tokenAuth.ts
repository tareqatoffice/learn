import { findLiveToken, type LiveToken } from "@/admin/tokens";
import { connectDb } from "@/lib/db";
import type { TokenScope } from "@/models";

export async function requireToken(req: Request, need: TokenScope = "read"): Promise<LiveToken> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw unauthorized();
  await connectDb();
  const token = await findLiveToken(match[1]);
  if (!token) throw unauthorized();
  if (need === "write" && token.scope !== "write") {
    throw Response.json({ error: "This API token is read-only; imports need a token with write access" }, { status: 403 });
  }
  return token;
}

const unauthorized = () => Response.json({ error: "Missing, unknown, revoked or expired API token" }, { status: 401 });

export async function withToken(
  req: Request,
  handler: (token: LiveToken) => Promise<Response>,
  need: TokenScope = "read",
): Promise<Response> {
  let token: LiveToken;
  try {
    token = await requireToken(req, need);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  return handler(token);
}
