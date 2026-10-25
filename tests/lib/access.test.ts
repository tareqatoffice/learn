import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../setup/mongo";
import { setUserAccess } from "@/admin/users";
import { accessRecordFor, accessStatusFor, saveRequestNote } from "@/lib/access";
import { REQUEST_NOTE_MAX } from "@/lib/access-limits";
import { resetEnvCache } from "@/lib/env";
import { User } from "@/models";

const MISSING_ID = "507f1f77bcf86cd799439011";

async function makeUser(fields: { email: string; status?: "pending" | "approved" | "blocked" }): Promise<string> {
  const doc = await User.create({ name: fields.email, lastLoginAt: new Date(), ...fields });
  return String(doc._id);
}

describe("access status", () => {
  let saved: string | undefined;

  beforeEach(async () => {
    saved = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "owner@x.com";
    resetEnvCache();
    await resetDb();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = saved;
    resetEnvCache();
  });

  describe("accessStatusFor", () => {
    it("reads the stored status for each state", async () => {
      const pending = await makeUser({ email: "p@x.com", status: "pending" });
      const blocked = await makeUser({ email: "b@x.com", status: "blocked" });
      const approved = await makeUser({ email: "a@x.com", status: "approved" });
      expect(await accessStatusFor({ userId: pending, email: "p@x.com" })).toBe("pending");
      expect(await accessStatusFor({ userId: blocked, email: "b@x.com" })).toBe("blocked");
      expect(await accessStatusFor({ userId: approved, email: "a@x.com" })).toBe("approved");
    });

    it("counts users created before the field existed as approved", async () => {
      const id = await makeUser({ email: "old@x.com" });
      expect(await accessStatusFor({ userId: id, email: "old@x.com" })).toBe("approved");
    });

    it("approves admins without a database record", async () => {
      expect(await accessStatusFor({ email: "Owner@x.com" })).toBe("approved");
    });

    it("is null when the user record is gone", async () => {
      expect(await accessStatusFor({ userId: MISSING_ID, email: "gone@x.com" })).toBeNull();
    });

    it("falls back to the email when the id is not an ObjectId", async () => {
      await makeUser({ email: "e@x.com", status: "blocked" });
      expect(await accessStatusFor({ userId: "dev-credentials-id", email: "E@x.com" })).toBe("blocked");
    });
  });

  describe("accessRecordFor", () => {
    it("returns the request details and is null for a missing user", async () => {
      const id = await makeUser({ email: "p@x.com", status: "pending" });
      await User.updateOne({ _id: id }, { requestNote: "backend team", blockReason: "why" });
      const record = await accessRecordFor({ userId: id, email: "p@x.com" });
      expect(record).toMatchObject({ status: "pending", requestNote: "backend team", blockReason: "why" });
      expect(record?.requestedAt).toBeInstanceOf(Date);
      expect(await accessRecordFor({ userId: MISSING_ID, email: "gone@x.com" })).toBeNull();
    });
  });

  describe("saveRequestNote", () => {
    it("saves a trimmed note for a pending user", async () => {
      const id = await makeUser({ email: "p@x.com", status: "pending" });
      expect(await saveRequestNote(id, "  I am on the backend team.  ")).toEqual({ ok: true });
      expect((await User.findById(id).lean())?.requestNote).toBe("I am on the backend team.");
    });

    it("rejects notes that are too short, too long or not text", async () => {
      const id = await makeUser({ email: "p@x.com", status: "pending" });
      expect(await saveRequestNote(id, "short")).toMatchObject({ ok: false });
      expect(await saveRequestNote(id, "x".repeat(REQUEST_NOTE_MAX + 1))).toMatchObject({ ok: false });
      expect(await saveRequestNote(id, undefined)).toMatchObject({ ok: false });
      expect((await User.findById(id).lean())?.requestNote).toBeUndefined();
    });

    it("refuses once the request has been reviewed", async () => {
      const id = await makeUser({ email: "a@x.com", status: "approved" });
      expect(await saveRequestNote(id, "a long enough note")).toEqual({
        ok: false,
        error: "Your request has already been reviewed.",
      });
    });

    it("asks for a new sign-in when the id is not valid", async () => {
      expect(await saveRequestNote("nope", "a long enough note")).toMatchObject({ ok: false });
    });
  });

  describe("setUserAccess", () => {
    it("approves a pending user and records the reviewer", async () => {
      const id = await makeUser({ email: "p@x.com", status: "pending" });
      expect(await setUserAccess({ id, status: "approved" }, "owner@x.com")).toEqual({ ok: true, id });
      const doc = await User.findById(id).lean();
      expect(doc).toMatchObject({ status: "approved", reviewedBy: "owner@x.com" });
      expect(doc?.reviewedAt).toBeInstanceOf(Date);
    });

    it("blocks with a trimmed reason and clears it on approval", async () => {
      const id = await makeUser({ email: "p@x.com", status: "pending" });
      await setUserAccess({ id, status: "blocked", reason: "  not a member  " }, "owner@x.com");
      expect((await User.findById(id).lean())?.blockReason).toBe("not a member");

      await setUserAccess({ id, status: "approved" }, "owner@x.com");
      const doc = await User.findById(id).lean();
      expect(doc?.status).toBe("approved");
      expect(doc?.blockReason).toBeUndefined();
    });

    it("clears an old reason when blocking again without one", async () => {
      const id = await makeUser({ email: "p@x.com", status: "pending" });
      await setUserAccess({ id, status: "blocked", reason: "first" }, "owner@x.com");
      await setUserAccess({ id, status: "blocked" }, "owner@x.com");
      const doc = await User.findById(id).lean();
      expect(doc?.status).toBe("blocked");
      expect(doc?.blockReason).toBeUndefined();
    });

    it("refuses admins, missing users, bad ids and bad statuses", async () => {
      const admin = await makeUser({ email: "owner@x.com", status: "approved" });
      expect(await setUserAccess({ id: admin, status: "blocked" }, "x@x.com")).toMatchObject({ ok: false });
      expect((await User.findById(admin).lean())?.status).toBe("approved");
      expect(await setUserAccess({ id: MISSING_ID, status: "approved" }, "x@x.com")).toMatchObject({ ok: false });
      expect(await setUserAccess({ id: "nope", status: "approved" }, "x@x.com")).toMatchObject({ ok: false });
      const id = await makeUser({ email: "p@x.com", status: "pending" });
      expect(await setUserAccess({ id, status: "pending" as never }, "x@x.com")).toMatchObject({ ok: false });
    });

    it("rejects a reason over the limit", async () => {
      const id = await makeUser({ email: "p@x.com", status: "pending" });
      const result = await setUserAccess({ id, status: "blocked", reason: "x".repeat(301) }, "owner@x.com");
      expect(result).toMatchObject({ ok: false });
      expect((await User.findById(id).lean())?.status).toBe("pending");
    });
  });
});
