import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../setup/mongo";
import { resetEnvCache } from "@/lib/env";
import { getProviders, isSignInAllowed, upsertUserOnSignIn } from "@/auth";
import { User } from "@/models";

const KEYS = [
  "ADMIN_EMAILS",
  "AUTH_DEV_LOGIN",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
] as const;

describe("sign-in", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(async () => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    process.env.ADMIN_EMAILS = "owner@x.com";
    resetEnvCache();
    await resetDb();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetEnvCache();
  });

  describe("upsertUserOnSignIn", () => {
    it("keeps one user per sub and refreshes lastLoginAt", async () => {
      const profile = { sub: "g-1", email: "a@x.com", name: "A" };
      const first = await upsertUserOnSignIn(profile);
      const firstDoc = await User.findById(first.userId).lean();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = await upsertUserOnSignIn({ ...profile, name: "A2", picture: "p.png" });

      expect(second.userId).toBe(first.userId);
      expect(await User.countDocuments()).toBe(1);
      const doc = await User.findById(first.userId).lean();
      expect(doc?.lastLoginAt.getTime()).toBeGreaterThan(firstDoc!.lastLoginAt.getTime());
      expect(doc).toMatchObject({ name: "A2", image: "p.png", googleId: "g-1" });
    });

    it("stores role admin only for ADMIN_EMAILS members", async () => {
      const owner = await upsertUserOnSignIn({ sub: "g-o", email: "Owner@X.com", name: "O" });
      const user = await upsertUserOnSignIn({ sub: "g-u", email: "u@x.com", name: "U" });
      expect(owner.role).toBe("admin");
      expect(user.role).toBe("user");
      expect((await User.findById(owner.userId).lean())?.role).toBe("admin");
      expect((await User.findById(user.userId).lean())?.role).toBe("user");
    });

    it("demotes the stored role when the email leaves ADMIN_EMAILS", async () => {
      await upsertUserOnSignIn({ sub: "g-o", email: "owner@x.com", name: "O" });
      process.env.ADMIN_EMAILS = "";
      resetEnvCache();
      const again = await upsertUserOnSignIn({ sub: "g-o", email: "owner@x.com", name: "O" });
      expect(again.role).toBe("user");
    });
  });

  describe("getProviders", () => {
    const ids = () => getProviders().map((p) => (typeof p === "function" ? p().id : p.id));

    it("has no credentials provider in production even with AUTH_DEV_LOGIN=true", () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.AUTH_SECRET = "s";
      process.env.AUTH_GOOGLE_ID = "id";
      process.env.AUTH_GOOGLE_SECRET = "secret";
      process.env.AUTH_DEV_LOGIN = "true";
      resetEnvCache();
      expect(ids()).toEqual(["google"]);
    });

    it("adds the dev login only in development with AUTH_DEV_LOGIN=true", () => {
      vi.stubEnv("NODE_ENV", "development");
      process.env.AUTH_DEV_LOGIN = "true";
      resetEnvCache();
      expect(ids()).toEqual(["google", "credentials"]);

      process.env.AUTH_DEV_LOGIN = "false";
      resetEnvCache();
      expect(ids()).toEqual(["google"]);
    });
  });

  describe("isSignInAllowed", () => {
    it("rejects Google accounts whose email is not verified", () => {
      expect(
        isSignInAllowed({ account: { provider: "google" }, profile: { email_verified: false } }),
      ).toBe(false);
      expect(isSignInAllowed({ account: { provider: "google" }, profile: {} })).toBe(false);
    });

    it("allows verified Google accounts", () => {
      expect(
        isSignInAllowed({ account: { provider: "google" }, profile: { email_verified: true } }),
      ).toBe(true);
    });

    it("does not affect the dev credentials provider", () => {
      expect(isSignInAllowed({ account: { provider: "credentials" }, profile: undefined })).toBe(
        true,
      );
    });
  });
});
