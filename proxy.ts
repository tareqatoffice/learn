import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { ACCESS_MESSAGES, accessStatusFor } from "@/features/auth/lib/access";
import { ACCESS_PATH, isPublicPath, routeAccess } from "@/features/auth/lib/authz";
import { buildCsp, frameOptionsFor, newNonce } from "@/lib/csp";
import { signInPath } from "@/features/auth/lib/nextPath";

function nextWithCsp(req: NextRequest): NextResponse {
  const nonce = newNonce();
  const { pathname } = req.nextUrl;
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development", pathname });
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  // Framing is set here with the CSP so both follow the same path rule (lib/csp.ts).
  res.headers.set("X-Frame-Options", frameOptionsFor(pathname));
  return res;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const handler = await auth(async (req) => {
    const { pathname } = req.nextUrl;
    const user = req.auth?.user;
    const email = user?.email;
    const status =
      email && !isPublicPath(pathname) ? await accessStatusFor({ userId: user?.id, email }) : null;
    const access = routeAccess(pathname, email ? { email, status } : null);
    if (access === "allow") return nextWithCsp(req);

    const isApi = pathname.startsWith("/api/");
    if (access === "pending" || access === "blocked") {
      return isApi
        ? NextResponse.json({ error: ACCESS_MESSAGES[access], code: access }, { status: 403 })
        : NextResponse.redirect(new URL(ACCESS_PATH, req.nextUrl));
    }
    if (access === "forbidden") {
      return isApi
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : new NextResponse("Forbidden", { status: 403 });
    }
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL(signInPath(`${pathname}${req.nextUrl.search}`), req.nextUrl));
  });
  return handler(request, event as never);
}

export const config = {
  matcher: ["/((?!_next/static/|_next/image|favicon\\.ico$|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
