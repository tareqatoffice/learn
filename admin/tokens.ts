import { createHash, randomBytes } from "node:crypto";
import { isValidObjectId, type Types } from "mongoose";
import { isAdminEmail } from "@/lib/authz";
import { ApiToken, User } from "@/models";

/** Only this hash is stored; the token itself is shown once at creation. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createToken(name: string, createdBy: string): Promise<{ id: string; token: string }> {
  const label = name.trim().slice(0, 100);
  if (!label) throw new Error("Token name is required");
  const token = `learn_${randomBytes(32).toString("base64url")}`;
  const doc = await ApiToken.create({ name: label, tokenHash: hashToken(token), createdBy });
  return { id: String(doc._id), token };
}

export async function revokeToken(id: string): Promise<void> {
  if (!isValidObjectId(id)) return;
  await ApiToken.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function listTokens(): Promise<{ id: string; name: string; createdBy: string; createdAt: Date; lastUsedAt?: Date; revokedAt?: Date }[]> {
  const rows = await ApiToken.find({}, { tokenHash: 0 })
    .sort({ createdAt: -1 })
    .lean<{ _id: Types.ObjectId; name: string; createdBy: Types.ObjectId; createdAt: Date; lastUsedAt?: Date; revokedAt?: Date }[]>();
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name,
    createdBy: String(r.createdBy),
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
    revokedAt: r.revokedAt,
  }));
}

/**
 * The live token behind a bearer value, recording its use; null when there is none. A token is
 * live while it is not revoked and its creator is still in ADMIN_EMAILS, so removing an admin
 * also cuts off the tokens they made.
 */
export async function findLiveToken(token: string): Promise<{ tokenId: string; name: string } | null> {
  const doc = await ApiToken.findOne({ tokenHash: hashToken(token), revokedAt: null }, { name: 1, createdBy: 1 }).lean<{
    _id: Types.ObjectId;
    name: string;
    createdBy: Types.ObjectId;
  }>();
  if (!doc) return null;
  const owner = await User.findById(doc.createdBy, { email: 1 }).lean<{ email: string }>();
  if (!isAdminEmail(owner?.email)) return null;
  await ApiToken.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } });
  return { tokenId: String(doc._id), name: doc.name };
}
