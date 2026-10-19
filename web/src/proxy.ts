import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { routeAccess } from "@/lib/authz";

// NextAuth is configured lazily (see auth.ts), so `auth(callback)` resolves to the
// request handler asynchronously and cannot be used directly as the export.
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const handler = await auth((req) => {
    const { pathname } = req.nextUrl;
    const email = req.auth?.user?.email;
    const access = routeAccess(pathname, email ? { email } : null);
    if (access === "allow") return NextResponse.next();

    const isApi = pathname.startsWith("/api/");
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
