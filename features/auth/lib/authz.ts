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

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || isUnder(pathname, "/api/auth") || isUnder(pathname, "/api/content");
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

export async function requireAdmin(): Promise<SessionUser> {
  const user = await sessionUser();
  if (!user) redirect("/");
  if (!user.isAdmin) throw new ForbiddenError();
  return user;
}
