import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createToken, revokeToken } from "@/features/admin/tokens";
import { GET as listContent } from "@/app/api/content/route";
import { POST as importContent } from "@/app/api/content/import/route";
import { GET as pullContent } from "@/app/api/content/pull/route";
import { GET as exportContent } from "@/app/api/admin/export/route";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { ApiToken, Question, Revision, User } from "@/models";
import { resetDb } from "../setup/mongo";
import { seedBook, seedQuestions } from "../progress/seed";

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(null) }));

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("ADMIN_EMAILS", "owner@example.test");
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});
afterAll(() => mongoose.disconnect());

const URL_BASE = "http://localhost:3000";

async function token(options: Parameters<typeof createToken>[2] = {}, now?: Date) {
  const owner = (await User.findOne({ email: "owner@example.test" })) ?? (await User.create({ email: "owner@example.test", name: "Owner", role: "admin" }));
  return createToken("cli", String(owner._id), { scope: "write", ...options }, now);
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const BOOK_MD = "# Part 1 — Basics\n\n## Q1. What is Y?\n\nY is y.\n";
const importBody = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ target: { kind: "book", slug: "api-book" }, title: "API Book", source: { kind: "book", markdown: BOOK_MD }, ...over });

describe("content API tokens", () => {
  it("rejects a request without a token", async () => {
    const res = await listContent(new Request(`${URL_BASE}/api/content`));
    expect(res.status).toBe(401);
  });

  it("rejects an unknown or revoked token", async () => {
    const { id, token: t } = await token();
    expect((await listContent(new Request(`${URL_BASE}/api/content`, { headers: auth("learn_nope") }))).status).toBe(401);
    expect(await revokeToken(id)).toBe(true);
    expect(await revokeToken(id)).toBe(false);
    expect((await listContent(new Request(`${URL_BASE}/api/content`, { headers: auth(t) }))).status).toBe(401);
  });

  it("refuses an import from a read-only token but lets it list (S5)", async () => {
    const { token: t } = await token({ scope: "read" });
    expect((await listContent(new Request(`${URL_BASE}/api/content`, { headers: auth(t) }))).status).toBe(200);
    const res = await importContent(new Request(`${URL_BASE}/api/content/import`, { method: "POST", headers: auth(t), body: importBody() }));
    expect(res.status).toBe(403);
  });

  it("makes read-only tokens unless write access is asked for", async () => {
    const owner = await User.create({ email: "owner@example.test", name: "Owner", role: "admin" });
    const { id } = await createToken("default", String(owner._id));
    expect((await ApiToken.findById(id).lean<{ scope: string }>())?.scope).toBe("read");
  });

  it("rejects an expired token (S5)", async () => {
    const { token: t } = await token({ lifetimeDays: 30 }, new Date(Date.now() - 31 * 86_400_000));
    expect((await listContent(new Request(`${URL_BASE}/api/content`, { headers: auth(t) }))).status).toBe(401);
    const { token: fresh } = await token({ lifetimeDays: 30 });
    expect((await listContent(new Request(`${URL_BASE}/api/content`, { headers: auth(fresh) }))).status).toBe(200);
  });

  it("treats a token made before scopes existed as able to import (S5)", async () => {
    const { id, token: t } = await token();
    await ApiToken.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $unset: { scope: "" } });
    const res = await importContent(new Request(`${URL_BASE}/api/content/import`, { method: "POST", headers: auth(t), body: importBody() }));
    expect(res.status).toBe(200);
  });

  it("rejects a token once its creator is no longer an admin", async () => {
    const { token: t } = await token();
    expect((await listContent(new Request(`${URL_BASE}/api/content`, { headers: auth(t) }))).status).toBe(200);
    vi.stubEnv("ADMIN_EMAILS", "someone-else@example.test");
    resetEnvCache();
    expect((await listContent(new Request(`${URL_BASE}/api/content`, { headers: auth(t) }))).status).toBe(401);
  });

  it("lists content for a valid token", async () => {
    const { token: t } = await token();
    await seedBook("js");
    const res = await listContent(new Request(`${URL_BASE}/api/content`, { headers: auth(t) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.books).toEqual([expect.objectContaining({ slug: "js", status: "published" })]);
    expect(body).toHaveProperty("series");
    expect(body).toHaveProperty("graphs");
  });

  it("pulls a book for a valid token", async () => {
    const { token: t } = await token();
    const book = await seedBook("js");
    await seedQuestions(book, 1);
    const res = await pullContent(new Request(`${URL_BASE}/api/content/pull?kind=book&slug=js`, { headers: auth(t) }));
    expect(res.status).toBe(200);
    expect((await res.json()).content).toContain("<!-- learn:question id=");
    const missing = await pullContent(new Request(`${URL_BASE}/api/content/pull?kind=book&slug=nope`, { headers: auth(t) }));
    expect(missing.status).toBe(404);
  });

  it("previews an import by default and writes nothing", async () => {
    const { token: t } = await token();
    const res = await importContent(new Request(`${URL_BASE}/api/content/import`, { method: "POST", headers: auth(t), body: importBody() }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ dryRun: true, creates: 1 });
    expect(await Question.countDocuments()).toBe(0);
  });

  it("commits with dryRun false and records the token as editor", async () => {
    const { token: t } = await token();
    const commit = (md: string) =>
      importContent(
        new Request(`${URL_BASE}/api/content/import`, {
          method: "POST",
          headers: auth(t),
          body: importBody({ dryRun: false, source: { kind: "book", markdown: md } }),
        }),
      );
    expect((await commit(BOOK_MD)).status).toBe(200);
    expect(await Question.countDocuments()).toBe(1);
    await commit(BOOK_MD.replace("Y is y.", "Y is why."));
    const revision = await Revision.findOne({ entityType: "Question" }).lean<{ editedBy: string }>();
    expect(revision?.editedBy).toBe("token:cli");
  });

  it("returns 400 with the report when the import has errors", async () => {
    const { token: t } = await token();
    const res = await importContent(
      new Request(`${URL_BASE}/api/content/import`, { method: "POST", headers: auth(t), body: importBody({ title: undefined }) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["target not found"]);
  });

  it("refuses an import body over the size limit before reading it (S9)", async () => {
    const { token: t } = await token();
    const res = await importContent(
      new Request(`${URL_BASE}/api/content/import`, { method: "POST", headers: { ...auth(t), "Content-Length": "20000000" }, body: importBody() }),
    );
    expect(res.status).toBe(413);
  });

  it("rejects a malformed body", async () => {
    const { token: t } = await token();
    const res = await importContent(new Request(`${URL_BASE}/api/content/import`, { method: "POST", headers: auth(t), body: "{" }));
    expect(res.status).toBe(400);
  });

  it("does not open the session-only export to tokens", async () => {
    await token();
    const res = await exportContent();
    expect(res.status).toBe(403);
  });
});
