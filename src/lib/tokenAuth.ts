import { findLiveToken } from "@/admin/tokens";
import { connectDb } from "@/lib/db";

/**
 * Bearer-token check for the content API. Throws a 401 Response for a missing,
 * unknown or revoked token; route handlers return it as is.
 */
export async function requireToken(req: Request): Promise<{ tokenId: string; name: string }> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw unauthorized();
  await connectDb();
  const token = await findLiveToken(match[1]);
  if (!token) throw unauthorized();
  return token;
}

const unauthorized = () => Response.json({ error: "Missing, unknown or revoked API token" }, { status: 401 });

/** Runs a token-authenticated handler, turning a thrown Response (the 401) into the reply. */
export async function withToken(req: Request, handler: (token: { tokenId: string; name: string }) => Promise<Response>): Promise<Response> {
  let token: { tokenId: string; name: string };
  try {
    token = await requireToken(req);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  return handler(token);
}
