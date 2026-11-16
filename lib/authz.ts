import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { accessStatusFor } from "@/lib/access";
import { getEnv } from "@/lib/env";
import type { AccessStatus } from "@/models";

export type RouteAccess = "allow" | "signin" | "forbidden" | "pending" | "blocked";

/** Where a signed-in user who is not (yet) let in is sent; it explains why and what happens next. */
export const ACCESS_PATH = "/access";

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

/** Paths that never need a session, so the proxy can skip the access-status lookup for them. */
export function isPublicPath(pathname: string): boolean {
  // Content API authenticates with a bearer token inside the route itself.
  return pathname === "/" || isUnder(pathname, "/api/auth") || isUnder(pathname, "/api/content");
}

/**
 * Pure route policy; the proxy maps the result to a redirect, a 403 or next().
 * `status` is the user's access status from the database, null when the user record is gone.
 */
export function routeAccess(
  pathname: string,
  session: { email: string; status: AccessStatus | null } | null,
): RouteAccess {
  if (isPublicPath(pathname)) return "allow";
  if (!session || !session.status) return "signin";
  // The access page explains every status, so it must stay reachable whatever the status is.
  if (isUnder(pathname, ACCESS_PATH)) return "allow";
  if (session.status !== "approved") return session.status;
  if (isUnder(pathname, "/admin") || isUnder(pathname, "/api/admin")) {
    return isAdminEmail(session.email) ? "allow" : "forbidden";
  }
  return "allow";
}

async function sessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email || !user.id) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name ?? user.email,
    image: user.image ?? undefined,
    isAdmin: isAdminEmail(user.email),
  };
}

/** One status lookup per request however many components and actions ask; args are primitives so cache() keys work. */
const cachedStatus = cache((userId: string, email: string) => accessStatusFor({ userId, email }));

/**
 * For server components and actions. Redirects to `/` when signed out or the user record is gone,
 * and to the access page while pending or blocked. The proxy checks the status too, but its matcher
 * skips some paths (static files) that can still carry a server action post, so the check is
 * repeated here rather than trusted.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await sessionUser();
  if (!user) redirect("/");
  const status = await cachedStatus(user.userId, user.email);
  if (!status) redirect("/");
  if (status !== "approved") redirect(ACCESS_PATH);
  return user;
}

/** Admins come from ADMIN_EMAILS and are always approved, so no status lookup is needed. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await sessionUser();
  if (!user) redirect("/");
  if (!user.isAdmin) throw new ForbiddenError();
  return user;
}
