import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEnv } from "@/lib/env";

export type RouteAccess = "allow" | "signin" | "forbidden";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  image?: string;
  isAdmin: boolean;
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Reads ADMIN_EMAILS on every call so removing an admin takes effect immediately. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getEnv().ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

const isUnder = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** Pure route policy; the proxy maps the result to a redirect, a 403 or next(). */
export function routeAccess(pathname: string, session: { email: string } | null): RouteAccess {
  if (pathname === "/" || isUnder(pathname, "/api/auth")) return "allow";
  // Content API authenticates with a bearer token inside the route itself.
  if (isUnder(pathname, "/api/content")) return "allow";
  if (!session) return "signin";
  if (isUnder(pathname, "/admin") || isUnder(pathname, "/api/admin")) {
    return isAdminEmail(session.email) ? "allow" : "forbidden";
  }
  return "allow";
}

/** For server components and actions. Redirects to `/` when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email || !user.id) redirect("/");
  return {
    userId: user.id,
    email: user.email,
    name: user.name ?? user.email,
    image: user.image ?? undefined,
    isAdmin: isAdminEmail(user.email),
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ForbiddenError();
  return user;
}
