import { createHash, randomBytes } from "node:crypto";
import { isValidObjectId, type Types } from "mongoose";
import { isAdminEmail } from "@/lib/authz";
import { ApiToken, TOKEN_SCOPES, type TokenScope, User } from "@/models";

/** Lifetimes the admin can pick for a new token, in days; null means it never expires. */
export const TOKEN_LIFETIMES = [30, 90, 365, null] as const;
export type TokenLifetime = (typeof TOKEN_LIFETIMES)[number];

export type LiveToken = { tokenId: string; name: string; scope: TokenScope };

/** Only this hash is stored; the token itself is shown once at creation. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createToken(
  name: string,
  createdBy: string,
  options: { scope?: TokenScope; lifetimeDays?: TokenLifetime } = {},
  now: Date = new Date(),
): Promise<{ id: string; token: string }> {
  const label = name.trim().slice(0, 100);
  if (!label) throw new Error("Token name is required");
  const scope = options.scope ?? "write";
  if (!TOKEN_SCOPES.includes(scope)) throw new Error("Unknown token scope");
  const days = options.lifetimeDays ?? null;
  if (!TOKEN_LIFETIMES.includes(days)) throw new Error("Unknown token lifetime");
  const token = `learn_${randomBytes(32).toString("base64url")}`;
  const doc = await ApiToken.create({
    name: label,
    tokenHash: hashToken(token),
    createdBy,
    scope,
    ...(days ? { expiresAt: new Date(now.getTime() + days * 86_400_000) } : {}),
  });
  return { id: String(doc._id), token };
}

/** False when there was no live token with that id (already revoked, or never existed). */
export async function revokeToken(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  const res = await ApiToken.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return res.modifiedCount > 0;
}

export type TokenRow = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  scope: TokenScope;
  expiresAt?: Date;
  expired: boolean;
  lastUsedAt?: Date;
  revokedAt?: Date;
};

export async function listTokens(now: Date = new Date()): Promise<TokenRow[]> {
  const rows = await ApiToken.find({}, { tokenHash: 0 })
    .sort({ createdAt: -1 })
    .lean<(Omit<TokenRow, "id" | "createdBy" | "scope" | "expired"> & { _id: Types.ObjectId; createdBy: Types.ObjectId; scope?: TokenScope })[]>();
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name,
    createdBy: String(r.createdBy),
    createdAt: r.createdAt,
    scope: r.scope ?? "write",
    expiresAt: r.expiresAt,
    expired: Boolean(r.expiresAt && r.expiresAt.getTime() <= now.getTime()),
    lastUsedAt: r.lastUsedAt,
    revokedAt: r.revokedAt,
  }));
}

/**
 * The live token behind a bearer value, recording its use; null when there is none. A token is
 * live while it is not revoked or expired and its creator is still in ADMIN_EMAILS, so removing an
 * admin also cuts off the tokens they made.
 */
export async function findLiveToken(token: string, now: Date = new Date()): Promise<LiveToken | null> {
  const doc = await ApiToken.findOne(
    { tokenHash: hashToken(token), revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    { name: 1, createdBy: 1, scope: 1 },
  ).lean<{
    _id: Types.ObjectId;
    name: string;
    createdBy: Types.ObjectId;
    scope?: TokenScope;
  }>();
  if (!doc) return null;
  const owner = await User.findById(doc.createdBy, { email: 1 }).lean<{ email: string }>();
  if (!isAdminEmail(owner?.email)) return null;
  await ApiToken.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } });
  return { tokenId: String(doc._id), name: doc.name, scope: doc.scope ?? "write" };
}
