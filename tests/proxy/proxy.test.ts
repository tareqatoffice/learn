import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import type { AccessStatus } from "@/models";

type Session = { user: { id: string; email: string } } | null;
let session: Session = null;

// auth(callback) resolves to a handler; the request carries the session as `req.auth`.
vi.mock("@/auth", () => ({
  auth: (callback: (req: NextRequest & { auth: Session }) => unknown) =>
    Promise.resolve((req: NextRequest) => callback(Object.assign(req, { auth: session }))),
}));

const statusMock = vi.fn<(user: { userId?: string; email: string }) => Promise<AccessStatus | null>>();
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  accessStatusFor: (user: { userId?: string; email: string }) => statusMock(user),
}));

import { proxy } from "@/proxy";

const run = async (path: string) =>
  (await proxy(new NextRequest(`http://localhost${path}`), {} as NextFetchEvent)) as Response;
const signIn = (email = "u@x.com") => {
  session = { user: { id: "64b000000000000000000001", email } };
};

describe("proxy", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "o@x.com";
    resetEnvCache();
    session = null;
    statusMock.mockReset();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = saved;
    resetEnvCache();
  });

  it.each(["pending", "blocked"] as const)("answers a %s user's API call with 403 and the reason", async (status) => {
    signIn();
    statusMock.mockResolvedValue(status);
    const res = await run("/api/admin/export");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: expect.stringMatching(/admin/), code: status });
  });

  it.each(["pending", "blocked"] as const)("sends a %s user's page request to /access", async (status) => {
    signIn();
    statusMock.mockResolvedValue(status);
    const res = await run("/dashboard");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/access");
  });

  it("lets a pending user reach /access", async () => {
    signIn();
    statusMock.mockResolvedValue("pending");
    const res = await run("/access");
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets an approved user through and still forbids /api/admin to non-admins", async () => {
    signIn();
    statusMock.mockResolvedValue("approved");
    expect((await run("/dashboard")).headers.get("x-middleware-next")).toBe("1");
    expect((await run("/api/admin/export")).status).toBe(403);
  });

  it("reads the status with the session's user id and email", async () => {
    signIn();
    statusMock.mockResolvedValue("approved");
    await run("/dashboard");
    expect(statusMock).toHaveBeenCalledWith({ userId: "64b000000000000000000001", email: "u@x.com" });
  });

  it("skips the status lookup on public paths and when signed out", async () => {
    signIn();
    await run("/");
    await run("/api/content/books");
    session = null;
    const res = await run("/api/x");
    expect(res.status).toBe(401);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("treats a session whose user record is gone as signed out", async () => {
    signIn();
    statusMock.mockResolvedValue(null);
    const res = await run("/dashboard");
    expect(res.headers.get("location")).toBe("http://localhost/");
  });
});
