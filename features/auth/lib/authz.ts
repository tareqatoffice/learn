import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { accessStatusFor } from "@/features/auth/lib/access";
import { getEnv } from "@/lib/env";
import type { AccessStatus } from "@/models";

export type RouteAccess = "allow" | "signin" | "forbidden" | "pending" | "blocked";

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

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getEnv().ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

const isUnder = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** SEO/metadata files crawlers and browsers fetch without a session. */
const METADATA_FILE =
  /^\/(?:robots\.txt|sitemap\.xml|manifest\.webmanifest|(?:icon|apple-icon|opengraph-image|twitter-image)(?:[-.][\w.-]*)?)$/;

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    METADATA_FILE.test(pathname) ||
    isUnder(pathname, "/api/auth") ||
    isUnder(pathname, "/api/content")
  );
}

export function routeAccess(
  pathname: string,
  session: { email: string; status: AccessStatus | null } | null,
): RouteAccess {
  if (isPublicPath(pathname)) return "allow";
  if (!session || !session.status) return "signin";
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

const cachedStatus = cache((userId: string, email: string) => accessStatusFor({ userId, email }));

export async function requireUser(): Promise<SessionUser> {
  const user = await sessionUser();
  if (!user) redirect("/");
  const status = await cachedStatus(user.userId, user.email);
  if (!status) redirect("/");
  if (status !== "approved") redirect(ACCESS_PATH);
  return user;
}

/**
 * For route handlers, which return a Response instead of redirecting: the signed-in, approved user,
 * or the 401/403 to send back. Repeats the proxy's status check so a handler stays gated on its own.
 */
export async function approvedRouteUser(): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await sessionUser();
  if (!user) return { response: new Response("Sign in first", { status: 401 }) };
  const status = await cachedStatus(user.userId, user.email);
  if (!status) return { response: new Response("Sign in first", { status: 401 }) };
  if (status !== "approved") return { response: new Response("Forbidden", { status: 403 }) };
  return { user };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await sessionUser();
  if (!user) redirect("/");
  if (!user.isAdmin) throw new ForbiddenError();
  return user;
}
