import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { REQUEST_NOTE_MAX, REQUEST_NOTE_MIN } from "@/lib/access-limits";
import { isAdminEmail } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { User, type AccessStatus } from "@/models";

/**
 * The status that applies to a user record: admins (ADMIN_EMAILS) are always approved, and users
 * created before the field existed have none and count as approved. The one place for this rule.
 */
export function effectiveStatus(email: string, stored: AccessStatus | undefined): AccessStatus {
  return isAdminEmail(email) ? "approved" : (stored ?? "approved");
}

/**
 * The signed-in user's access status, read from the database on every call so an approval or a
 * block takes effect on the next request rather than when the 30-day JWT expires. Admins are always
 * approved. Null when the user document is gone (stale session): callers treat that as signed out.
 */
export async function accessStatusFor(user: { userId?: string; email: string }): Promise<AccessStatus | null> {
  if (isAdminEmail(user.email)) return "approved";
  await connectDb();
  const doc = await User.findOne(userFilter(user), { status: 1 }).lean<{ status?: AccessStatus }>();
  if (!doc) return null;
  return effectiveStatus(user.email, doc.status);
}

export interface AccessRecord {
  status: AccessStatus;
  requestedAt?: Date;
  requestNote?: string;
  blockReason?: string;
}

/** What the access page shows the user about their own request; null when the user record is gone. */
export async function accessRecordFor(user: { userId?: string; email: string }): Promise<AccessRecord | null> {
  await connectDb();
  const doc = await User.findOne(userFilter(user), { status: 1, createdAt: 1, requestNote: 1, blockReason: 1 }).lean<{
    status?: AccessStatus;
    createdAt?: Date;
    requestNote?: string;
    blockReason?: string;
  }>();
  if (!doc) return null;
  return {
    status: effectiveStatus(user.email, doc.status),
    requestedAt: doc.createdAt,
    requestNote: doc.requestNote,
    blockReason: doc.blockReason,
  };
}

const userFilter = (user: { userId?: string; email: string }) =>
  user.userId && isValidObjectId(user.userId) ? { _id: user.userId } : { email: user.email.trim().toLowerCase() };

const requestNote = z
  .string({ error: "Write a short note for the admin" })
  .trim()
  .min(REQUEST_NOTE_MIN, `Tell the admin a little more (at least ${REQUEST_NOTE_MIN} characters)`)
  .max(REQUEST_NOTE_MAX, `Keep it under ${REQUEST_NOTE_MAX} characters`);

/**
 * Saves the note a pending user leaves for the admin who reviews them. Only pending users can
 * leave one: once reviewed, the note has nothing left to inform.
 */
export async function saveRequestNote(
  userId: string,
  note: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = requestNote.safeParse(note);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!isValidObjectId(userId)) return { ok: false, error: "Sign in again to send a note." };
  await connectDb();
  const updated = await User.updateOne({ _id: userId, status: "pending" }, { $set: { requestNote: parsed.data } });
  if (updated.matchedCount === 0) return { ok: false, error: "Your request has already been reviewed." };
  return { ok: true };
}

/** User-facing copy for a status that keeps someone out, shared by the API replies and the access page. */
export const ACCESS_MESSAGES = {
  pending: "Your account is waiting for an admin to approve it.",
  blocked: "Your account has been blocked by an admin.",
} as const;
