import { createHash, randomBytes } from "node:crypto";
import { isValidObjectId, type Types } from "mongoose";
import { ApiToken } from "@/models";

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

/** The live (not revoked) token behind a bearer value, recording its use; null when there is none. */
export async function findLiveToken(token: string): Promise<{ tokenId: string; name: string } | null> {
  const doc = await ApiToken.findOneAndUpdate(
    { tokenHash: hashToken(token), revokedAt: null },
    { $set: { lastUsedAt: new Date() } },
    { projection: { name: 1 } },
  ).lean<{ _id: Types.ObjectId; name: string }>();
  return doc ? { tokenId: String(doc._id), name: doc.name } : null;
}
