import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { ACCESS_MESSAGES, accessStatusFor } from "@/lib/access";
import { ACCESS_PATH, isPublicPath, routeAccess } from "@/lib/authz";

// NextAuth is configured lazily (see auth.ts), so `auth(callback)` resolves to the
// request handler asynchronously and cannot be used directly as the export.
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const handler = await auth(async (req) => {
    const { pathname } = req.nextUrl;
    const user = req.auth?.user;
    const email = user?.email;
    // Every non-public request re-reads the status, so approving or blocking someone applies at once.
    const status =
      email && !isPublicPath(pathname) ? await accessStatusFor({ userId: user?.id, email }) : null;
    const access = routeAccess(pathname, email ? { email, status } : null);
    if (access === "allow") return NextResponse.next();

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
      : NextResponse.redirect(new URL("/", req.nextUrl));
  });
  return handler(request, event as never);
}

// Static asset paths skip the proxy, but never under api/ or admin/.
// Next requires this config to be a literal, so tests read `config.matcher[0]`.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|(?!api/|admin/).*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
