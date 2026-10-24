import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

import { ForbiddenError, isAdminEmail, requireAdmin, requireUser, routeAccess } from "@/lib/authz";

describe("authz", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "o@x.com";
    resetEnvCache();
    authMock.mockReset();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = saved;
    resetEnvCache();
  });

  describe("routeAccess", () => {
    it("requires sign-in for app pages", () => {
      expect(routeAccess("/dashboard", null)).toBe("signin");
    });

    it("keeps / and /api/auth/* public", () => {
      expect(routeAccess("/", null)).toBe("allow");
      expect(routeAccess("/api/auth/callback/google", null)).toBe("allow");
    });

    it("lets /api/content/* through for the route's own token check", () => {
      expect(routeAccess("/api/content/books", null)).toBe("allow");
    });

    it("forbids /admin/* and /api/admin/* for non-admins", () => {
      expect(routeAccess("/admin/books", { email: "u@x.com" })).toBe("forbidden");
      expect(routeAccess("/api/admin/export", { email: "u@x.com" })).toBe("forbidden");
      expect(routeAccess("/admin/books", null)).toBe("signin");
    });

    it("matches admin emails case-insensitively", () => {
      process.env.ADMIN_EMAILS = "o@x.com, U@X.com";
      resetEnvCache();
      expect(routeAccess("/admin/books", { email: "u@x.com" })).toBe("allow");
      expect(routeAccess("/admin/books", { email: "U@x.COM" })).toBe("allow");
    });

    it("does not treat look-alike paths as admin routes", () => {
      expect(routeAccess("/administrator", { email: "u@x.com" })).toBe("allow");
    });
  });

  describe("removing an admin from ADMIN_EMAILS (Review Focus 5)", () => {
    it("revokes admin on the next call", () => {
      expect(isAdminEmail("o@x.com")).toBe(true);
      expect(routeAccess("/admin", { email: "o@x.com" })).toBe("allow");

      process.env.ADMIN_EMAILS = "";
      resetEnvCache();

      expect(isAdminEmail("o@x.com")).toBe(false);
      expect(routeAccess("/admin", { email: "o@x.com" })).toBe("forbidden");
    });

    it("is false for missing emails", () => {
      expect(isAdminEmail(null)).toBe(false);
      expect(isAdminEmail(undefined)).toBe(false);
    });
  });

  describe("requireUser / requireAdmin", () => {
    it("redirects to / when signed out", async () => {
      authMock.mockResolvedValue(null);
      await expect(requireUser()).rejects.toMatchObject({
        digest: expect.stringContaining("NEXT_REDIRECT;replace;/;"),
      });
    });

    it("returns the session user and recomputes isAdmin from env", async () => {
      authMock.mockResolvedValue({
        user: { id: "u1", email: "o@x.com", name: "Owner", image: "i.png", isAdmin: false },
      });
      await expect(requireUser()).resolves.toEqual({
        userId: "u1",
        email: "o@x.com",
        name: "Owner",
        image: "i.png",
        isAdmin: true,
      });
    });

    it("requireAdmin rejects with ForbiddenError for a non-admin", async () => {
      authMock.mockResolvedValue({
        user: { id: "u2", email: "u@x.com", name: "User", isAdmin: true },
      });
      const error = await requireAdmin().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).status).toBe(403);
    });

    it("requireAdmin resolves for an admin", async () => {
      authMock.mockResolvedValue({ user: { id: "u1", email: "o@x.com", name: "Owner" } });
      await expect(requireAdmin()).resolves.toMatchObject({ userId: "u1", isAdmin: true });
    });
  });
});
